/**
 * C-2 verification: is the browser really unable to write to Appwrite any more,
 * and is the server really refusing what it should?
 *
 *   npx tsx scripts/verify-write-authorization.ts
 *
 * Runs against the configured Appwrite project. It creates its own throwaway
 * staff accounts and records under a `verify-c2-` prefix and deletes them at the
 * end, so it never touches operator data. Existing staff records are used
 * read-only as fixtures.
 *
 * Every test prints PASS or FAIL. The exit code is non-zero if anything failed,
 * so it can gate a deploy.
 */
import config, { assertConfigValid } from '../server/config';
import {
  COLLECTIONS,
  createUser,
  deleteDocument as appwriteDelete,
  getDocument,
  listDocuments,
  appwriteRequest,
  AppwriteRestError,
  upsertDocument,
  addUserToTeam,
  findTeam,
  STAFF_TEAM_ID,
  areaTeamId,
} from '../server/appwrite-rest';
import { AuthError, type AuthProfile, type SessionClaims } from '../server/auth';
import { authorizeWrite, invalidateAreaCaches } from '../server/write-authz';
import { permissionsForArea } from '../server/appwrite-rest';
import { ALL_SECTIONS, ALL_FUNCTIONS } from '../src/types';

assertConfigValid();

const PREFIX = 'verify-c2-';
const created: { collection: string; id: string }[] = [];
const createdUsers: string[] = [];

/**
 * Appwrite 2.3 validates custom document ids as `[A-Za-z0-9_]` up to 36 chars and
 * rejects hyphens, so every id here is built from underscores and a counter
 * rather than by interpolating a label.
 */
let idCounter = 0;
function mkId(label: string): string {
  idCounter += 1;
  return `vc2_${label.replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}_${idCounter}`;
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function report(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

function track(collection: string, id: string): void {
  created.push({ collection, id });
}

/** Stops a row being deleted twice, for fixtures that are replaced mid-run. */
function untrack(id: string): void {
  const index = created.findIndex((row) => row.id === id);
  if (index >= 0) created.splice(index, 1);
}

/**
 * Appwrite has no user-deletion helper in the server client, and this script
 * should not add one to production code just to tidy up after itself.
 */
async function deleteUserViaApi(userId: string): Promise<void> {
  await appwriteRequest({ method: 'DELETE', path: `/users/${userId}` });
}

let cleanedUp = false;

async function cleanup(): Promise<void> {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const row of created) {
    try {
      await appwriteDelete(row.collection, row.id);
    } catch {
      /* best effort */
    }
  }
  for (const userId of createdUsers) {
    try {
      await deleteUserViaApi(userId);
    } catch {
      /* best effort */
    }
  }
  created.length = 0;
  createdUsers.length = 0;
}

// Cleanup used to sit on the happy path, so a run that threw partway through
// left its fixtures in the live database. It is idempotent, so it can also be
// wired to the failure paths.
let cleaningUp: Promise<void> | null = null;
const cleanUpThenExit = (code: number) => {
  cleaningUp = cleaningUp ?? cleanup();
  cleaningUp.then(() => process.exit(code), () => process.exit(code));
};
process.on('unhandledRejection', (error) => {
  console.error('\nverify:write-authz aborted:', error);
  cleanUpThenExit(1);
});
process.on('uncaughtException', (error) => {
  console.error('\nverify:write-authz crashed:', error);
  cleanUpThenExit(1);
});

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

/** A staff record plus a matching live Appwrite session, so claims are real. */
interface Fixture {
  staffId: string;
  email: string;
  password: string;
  profile: AuthProfile;
  claims: SessionClaims;
  /** A real Appwrite JWT for this account, as the browser would hold. */
  jwt: string;
}

async function makeFixture(input: {
  label: string;
  role: string;
  sections: readonly string[];
  functions: readonly string[];
  areas: readonly string[];
}): Promise<Fixture> {
  const staffId = mkId(input.label);
  const email = `${staffId}@verify.invalid`;  const password = `Tg-${Math.random().toString(36).slice(2, 8)}-Aa1${Math.random().toString(36).slice(2, 8)}`;

  await upsertDocument(
    COLLECTIONS.staff,
    staffId,
    {
      id: staffId,
      name: `Verify ${input.label}`,
      email,
      role: input.role,
      status: 'Active',
      allowedSections: input.sections,
      allowedFunctions: input.functions,
      assignedAreaIds: [...input.areas],
    },
    permissionsForArea(null, COLLECTIONS.staff)
  );
  track(COLLECTIONS.staff, staffId);

  const user = await createUser({ email, password, name: `Verify ${input.label}`, labels: ['trigon', `role:${input.role === 'Admin' ? 'Admin' : 'Staff'}`] });
  createdUsers.push(user.$id);

  /**
   * Team membership is what makes sections E and F meaningful. A user in no
   * team cannot write anything and cannot read anything, so a write test run
   * against them proves nothing. Every real staff account belongs to
   * team:trigon_staff plus one team per assigned area, so the fixtures do too.
   */
  await addUserToTeam(STAFF_TEAM_ID, email, ['member']);
  for (const area of input.areas) {
    await addUserToTeam(areaTeamId(area), email, ['member']);
  }

  // A real session, so the claims below are what a signed-in browser would hold.
  const { jwt, sessionId } = await mintSessionJwt(email, password);

  const isAdmin = input.role === 'Admin';
  const profile: AuthProfile = {
    uid: user.$id,
    role: isAdmin ? 'Admin' : 'Staff',
    staffId,
    name: `Verify ${input.label}`,
    email,
    allowedSections: [...input.sections],
    allowedFunctions: [...input.functions],
    assignedAreaIds: [...input.areas],
  };

  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    uid: user.$id,
    appwriteSessionId: sessionId,
    role: profile.role,
    entityId: staffId,
    name: profile.name,
    email,
    iat: now,
    exp: now + 3600,
  };

  return { staffId, email, password, profile, claims, jwt };
}

/**
 * Mints a session JWT the way Appwrite 2.3 actually works.
 *
 * NOTE: server/appwrite-rest.ts `createUserSession` still calls the old
 * POST /account/sessions/token {email,password}, which this instance rejects
 * with `Param "userId" is not optional`. The 2.x flow is:
 *   1. POST /account/sessions/email {email, password}  -> a session
 *   2. POST /account/jwt         (with that session)   -> a 15 minute JWT
 *
 * This helper is duplicated here on purpose: it keeps the verification run
 * independent of the production login code, which is a separate defect and is
 * reported rather than silently rewritten as part of C-2.
 */
async function mintSessionJwt(email: string, password: string): Promise<{
  jwt: string;
  sessionId: string;
}> {
  const base = config.appwrite.endpoint;
  const project = config.appwrite.projectId;

  const sessionRes = await fetch(`${base}/account/sessions/email`, {
    method: 'POST',
    headers: { 'X-Appwrite-Project': project, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const sessionBody = (await sessionRes.json()) as Record<string, unknown>;
  if (!sessionRes.ok) {
    throw new Error(
      `session creation failed: ${sessionRes.status} ${JSON.stringify(sessionBody)}`
    );
  }
  const cookie = (sessionRes.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');

  const jwtRes = await fetch(`${base}/account/jwt`, {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': project,
      'content-type': 'application/json',
      Cookie: cookie,
      'x-appwrite-session': String(sessionBody.$id),
    },
  });
  const jwtBody = (await jwtRes.json()) as Record<string, unknown>;
  if (!jwtRes.ok || typeof jwtBody.jwt !== 'string') {
    throw new Error(`jwt creation failed: ${jwtRes.status} ${JSON.stringify(jwtBody)}`);
  }
  return { jwt: jwtBody.jwt, sessionId: String(sessionBody.$id) };
}

async function makeCustomer(input: { label: string; areaId: string }): Promise<string> {
  const id = mkId(input.label);
  await upsertDocument(
    COLLECTIONS.customers,
    id,
    {
      id,
      name: `Verify ${input.label}`,
      username: `verify-${input.label}`,
      mobile: '03000000000',
      email: `${id}@verify.invalid`,
      cnic: '00000-0000000-0',
      address: 'Verification address',
      areaId: input.areaId,
      areaName: input.areaId,
      packageId: 'pkg-verify',
      packageName: 'Verify',
      monthlyFee: 1000,
      totalMonthly: 1000,
      status: 'Active',
      createdAt: new Date().toISOString(),
    },
    permissionsForArea(input.areaId, COLLECTIONS.customers)
  );
  track(COLLECTIONS.customers, id);
  return id;
}

async function makeInvoice(input: { label: string; customerId: string }): Promise<string> {
  const id = mkId(input.label);
  await upsertDocument(
    COLLECTIONS.invoices,
    id,
    {
      id,
      invoiceNumber: `VER-${input.label}`,
      customerId: input.customerId,
      customerName: 'Verify',
      month: 'September 2026',
      year: 2026,
      amount: 1000,
      paidAmount: 0,
      remainingAmount: 1000,
      status: 'Unpaid',
      createdAt: new Date().toISOString(),
    },
    // Invoices carry no areaId; the row is readable staff-wide, exactly as the
    // pre-existing backfill leaves them.
    permissionsForArea(null, COLLECTIONS.invoices)
  );
  track(COLLECTIONS.invoices, id);
  return id;
}

async function expectDenied(
  name: string,
  run: () => Promise<unknown>
): Promise<void> {
  try {
    await run();
    report(name, false, 'expected the server to refuse this, but it allowed it');
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 'threw';
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof AuthError && (status === 403 || status === 404)) {
      report(name, true);
    } else {
      report(name, false, `expected 403/404, got ${status}: ${message}`);
    }
  }
}

async function expectAllowed(name: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    report(name, true);
  } catch (error) {
    report(
      name,
      false,
      `expected this to be allowed, got: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Fixtures: two areas, three roles                                           */
/* -------------------------------------------------------------------------- */

/**
 * Real, existing areas. Using live area ids means the team memberships the
 * fixtures are given are the same ones real staff hold, and the area rows the
 * policy is judged against are genuine. Every row this script creates is
 * prefixed `verify-c2-` and is deleted at the end.
 */
const AREA_A = 'area-1';
const AREA_B = 'area-2';

for (const [label, teamId] of [
  ['AREA_A', areaTeamId(AREA_A)],
  ['AREA_B', areaTeamId(AREA_B)],
  ['staff', STAFF_TEAM_ID],
] as const) {
  const team = await findTeam(teamId);
  if (!team) throw new Error(`team ${teamId} (${label}) does not exist; run "npm run provision" first`);
}

console.log('Preparing fixtures...\n');

const ALL_SECTION_IDS = ALL_SECTIONS.map((s) => s.id as string);
const ALL_FUNCTION_IDS = ALL_FUNCTIONS.map((f) => f.id as string);

const areaAAdmin = await makeFixture({
  label: 'areaA-admin',
  role: 'Admin',
  sections: ALL_SECTION_IDS,
  functions: ALL_FUNCTION_IDS,
  areas: [AREA_A],
});
const areaATech = await makeFixture({
  label: 'areaA-tech',
  role: 'Technician',
  sections: ['dashboard', 'customers', 'connections', 'complaints'],
  functions: ['add_customers', 'edit_customers', 'approve_connections'],
  areas: [AREA_A],
});
const areaBBilling = await makeFixture({
  label: 'areaB-billing',
  role: 'Accounts',
  sections: ['dashboard', 'customers', 'invoices', 'payments', 'billing'],
  functions: ['receive_payments', 'generate_bills', 'add_customers', 'edit_customers'],
  areas: [AREA_B],
});
const noAreaSupport = await makeFixture({
  label: 'noarea-support',
  role: 'Support',
  sections: ['dashboard', 'messages', 'announcements'],
  functions: ['send_messages', 'edit_customers'],
  areas: [],
});

invalidateAreaCaches();

const customerA = await makeCustomer({ label: 'custA', areaId: AREA_A });
const customerB = await makeCustomer({ label: 'custB', areaId: AREA_B });
const invoiceA = await makeInvoice({ label: 'invA', customerId: customerA });
const invoiceB = await makeInvoice({ label: 'invB', customerId: customerB });

const write = (fx: Fixture, collection: string, documentId: string, incoming: unknown) =>
  authorizeWrite({
    claims: fx.claims,
    profile: fx.profile,
    collection: collection as never,
    documentId,
    operation: 'upsert',
    incoming: incoming as Record<string, unknown>,
  });

/* -------------------------------------------------------------------------- */
/*  A. Authorized user writes in their own area                               */
/* -------------------------------------------------------------------------- */

console.log('A) Authorized user, own area');
await expectAllowed('A1  tech creates a customer in their own area', () =>
  write(
    areaATech,
    'customers',
    mkId('a1'),
    { id: 'x', name: 'A1', areaId: AREA_A, status: 'Active' }
  )
);
await expectAllowed('A2  tech updates their own area customer', () =>
  write(areaATech, 'customers', customerA, { id: customerA, name: 'Renamed', areaId: AREA_A })
);
await expectAllowed('A3  tech writes an activity log entry', () =>
  write(areaATech, 'activityLogs', mkId('a3'), {
    id: 'x',
    action: 'Test',
    collection: 'customers',
  })
);
await expectAllowed('A4  area-B billing records a payment for its own customer', () =>
  write(areaBBilling, 'payments', mkId('a4'), {
    id: 'x',
    customerId: customerB,
    amount: 500,
  })
);

/* -------------------------------------------------------------------------- */
/*  B. Cross-area writes are refused                                          */
/* -------------------------------------------------------------------------- */

console.log('\nB) Cross-area writes');
await expectDenied('B1  area-A tech updates an area-B customer', () =>
  write(areaATech, 'customers', customerB, { id: customerB, name: 'Hijacked', areaId: AREA_B })
);
await expectDenied('B2  area-A tech deletes an area-B customer', () =>
  authorizeWrite({
    claims: areaATech.claims,
    profile: areaATech.profile,
    collection: 'customers',
    documentId: customerB,
    operation: 'delete',
    incoming: null,
  })
);
await expectDenied('B3  area-A tech creates a customer in area B', () =>
  write(areaATech, 'customers', mkId('b3'), {
    id: 'x',
    name: 'Intruder',
    areaId: AREA_B,
  })
);
await expectDenied('B4  area-A tech updates an invoice belonging to an area-B customer', () =>
  write(areaATech, 'invoices', invoiceB, { id: invoiceB, amount: 1 })
);
await expectDenied('B5  area-B billing updates an invoice of an area-A customer', () =>
  write(areaBBilling, 'invoices', invoiceA, { id: invoiceA, amount: 1 })
);
await expectDenied('B6  area-A tech records a payment against an area-B customer', () =>
  write(
    areaATech,
    'payments',
    mkId('b6'),
    { id: 'x', customerId: customerB, amount: 100 }
  )
);

/* -------------------------------------------------------------------------- */
/*  C. Tampering with areaId / customerId does not move the boundary           */
/* -------------------------------------------------------------------------- */

console.log('\nC) Payload tampering');
await expectDenied('C1  claims area A while writing a row stored in area B', () =>
  write(areaATech, 'customers', customerB, { id: customerB, name: 'x', areaId: AREA_A })
);
await expectDenied('C2  repointing an invoice at a friendly customer to gain access', () =>
  write(areaATech, 'invoices', invoiceB, { id: invoiceB, customerId: customerA, amount: 0 })
);
await expectDenied('C3  area-B billing repoints an area-A invoice at its own customer', () =>
  write(areaBBilling, 'invoices', invoiceA, { id: invoiceA, customerId: customerB })
);
await expectDenied('C4  tech moves their own customer from area A to area B', () =>
  write(areaATech, 'customers', customerA, { id: customerA, areaId: AREA_B })
);
await expectAllowed('C5  an administrator may move a customer between areas', () =>
  write(areaAAdmin, 'customers', customerA, { id: customerA, areaId: AREA_B })
);
// Put it back so later tests are not affected by the move above.
await appwriteDelete(COLLECTIONS.customers, customerA);
untrack(customerA);
const customerA2 = await makeCustomer({ label: 'custA2', areaId: AREA_A });
invalidateAreaCaches();

/* -------------------------------------------------------------------------- */
/*  D. Role and section refusals                                             */
/* -------------------------------------------------------------------------- */

console.log('\nD) Role, section and function');
await expectDenied('D1  a non-admin cannot write the staff collection', () =>
  write(areaATech, 'staff', areaATech.staffId, { id: areaATech.staffId, role: 'Admin' })
);
await expectDenied('D2  a non-admin cannot create an area', () =>
  write(areaATech, 'areas', mkId('d2'), { id: 'x', name: 'New area' })
);
await expectDenied('D3  a non-admin cannot change company settings', () =>
  write(areaATech, 'settings', 'settings', { id: 'settings', companyName: 'Hijacked' })
);
await expectDenied('D4  a user without the invoices module cannot write invoices', () =>
  write(noAreaSupport, 'invoices', invoiceA, { id: invoiceA, amount: 1 })
);
await expectDenied('D5  a user without manage_packages cannot write packages', () =>
  write(areaATech, 'packages', mkId('d5'), { id: 'x', name: 'pkg' })
);
await expectDenied('D6  a non-admin cannot promote a colleague to Admin', () =>
  write(areaATech, 'staff', 'staff-admin', { id: 'staff-admin', role: 'Admin' })
);
await expectAllowed('D7  an administrator may write the staff collection', () =>
  write(areaAAdmin, 'staff', mkId('d7'), {
    id: 'x',
    name: 'New hire',
    email: 'n@example.com',
    role: 'Staff',
  })
);
await expectAllowed('D8  an administrator may write company settings', () =>
  write(areaAAdmin, 'settings', 'settings', { id: 'settings', companyName: 'Trigon Links' })
);
await expectDenied('D9  staff with no assigned areas cannot write an area-scoped record', () =>
  write(noAreaSupport, 'customers', customerA2, { id: customerA2, name: 'x', areaId: AREA_A })
);

/* -------------------------------------------------------------------------- */
/*  E. The browser can no longer write to Appwrite at all                      */
/* -------------------------------------------------------------------------- */

console.log('\nE) Direct Appwrite access from a staff session');

const db = config.appwrite.databaseId;
const base = `/databases/${db}/collections`;

async function asUser(
  method: 'POST' | 'PATCH' | 'DELETE',
  collection: string,
  documentId: string | null,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number }> {
  const path = documentId
    ? `${base}/${collection}/documents/${documentId}`
    : `${base}/${collection}/documents`;
  try {
    await appwriteRequest({
      method,
      path,
      body: { ...body, ...(documentId ? {} : { documentId }) },
      // No X-Appwrite-Key: this is the browser's own session, exactly as the
      // Appwrite Web SDK would send it.
      authenticated: false,
    });
    return { ok: true, status: 200 };
  } catch (error) {
    return { ok: false, status: error instanceof AppwriteRestError ? error.status : 0 };
  }
}

// The SDK sends the session as a JWT, not as an API key. `appwriteRequest` with
// authenticated:false sends no credentials at all, which is the strictest form of
// this test: it proves a credential-less client is refused. The session-token
// variant is checked separately below.
const anonCreate = await asUser('POST', COLLECTIONS.customers, null, {
  data: JSON.stringify({ id: `${PREFIX}anon`, name: 'anon' }),
});
report(
  'E1  unauthenticated client cannot create a document',
  !anonCreate.ok,
  anonCreate.ok ? 'the create succeeded' : `refused with ${anonCreate.status}`
);
const anonUpdate = await asUser('PATCH', COLLECTIONS.customers, customerA2, {
  data: JSON.stringify({ id: customerA2, name: 'anon' }),
});
report(
  'E2  unauthenticated client cannot update a document',
  !anonUpdate.ok,
  anonUpdate.ok ? 'the update succeeded' : `refused with ${anonUpdate.status}`
);
const anonDelete = await asUser('DELETE', COLLECTIONS.customers, customerA2, {});
report(
  'E3  unauthenticated client cannot delete a document',
  !anonDelete.ok,
  anonDelete.ok ? 'the delete succeeded' : `refused with ${anonDelete.status}`
);

/**
 * The decisive test: the real staff session token, used the way the Web SDK
 * uses it. `appwriteRequest` cannot send a JWT, so this goes through the SDK's
 * own client the way the browser would.
 *
 * areaATech is a member of team:trigon_staff and team:area_<AREA_A>, which is
 * exactly the membership a real technician has. Anything this account can still
 * write is a genuine hole, not an artifact of a user with no permissions.
 */
async function withSdkJwt<T = unknown>(
  fn: (databases: import('appwrite').Databases) => Promise<T>
): Promise<{ ok: boolean; status: number; value?: T }> {
  const { Client, Databases } = await import('appwrite');
  const client = new Client()
    .setEndpoint(config.appwrite.endpoint)
    .setProject(config.appwrite.projectId)
    .setJWT(areaATech.jwt);
  const databases = new Databases(client);
  try {
    const value = await fn(databases);
    return { ok: true, status: 200, value };
  } catch (error: unknown) {
    const code = (error as { code?: number })?.code;
    return { ok: false, status: typeof code === 'number' ? code : 0 };
  }
}

// The document id and the payload id must agree, and the id is tracked so that
// a regression, where the create unexpectedly succeeds, is still cleaned up.
const e4Id = mkId('e4jwt');
track(COLLECTIONS.customers, e4Id);
const jwtCreate = await withSdkJwt((d) =>
  d.createDocument(db, COLLECTIONS.customers, e4Id, {
    id: e4Id,
    name: 'jwt create',
    areaId: AREA_A,
  })
);
report(
  'E4  a signed-in staff JWT cannot create a document directly',
  !jwtCreate.ok,
  jwtCreate.ok ? 'THE CREATE SUCCEEDED - the browser still has a write path' : `refused with ${jwtCreate.status}`
);

const jwtUpdate = await withSdkJwt((d) =>
  d.updateDocument(db, COLLECTIONS.customers, customerA2, {
    id: customerA2,
    name: 'jwt update',
  })
);
report(
  'E5  a signed-in staff JWT cannot update a document directly',
  !jwtUpdate.ok,
  jwtUpdate.ok ? 'THE UPDATE SUCCEEDED - the browser still has a write path' : `refused with ${jwtUpdate.status}`
);

const e6Id = mkId('e6jwt');
track(COLLECTIONS.customers, e6Id);
const jwtUpsert = await withSdkJwt((d) =>
  d.upsertDocument(db, COLLECTIONS.customers, e6Id, {
    id: e6Id,
    name: 'jwt upsert',
    areaId: AREA_A,
  })
);
report(
  'E6  a signed-in staff JWT cannot upsert a document directly',
  !jwtUpsert.ok,
  jwtUpsert.ok ? 'THE UPSERT SUCCEEDED - the browser still has a write path' : `refused with ${jwtUpsert.status}`
);

const jwtDelete = await withSdkJwt((d) => d.deleteDocument(db, COLLECTIONS.customers, customerA2));
report(
  'E7  a signed-in staff JWT cannot delete a document directly',
  !jwtDelete.ok,
  jwtDelete.ok ? 'THE DELETE SUCCEEDED - the browser still has a write path' : `refused with ${jwtDelete.status}`
);

/* -------------------------------------------------------------------------- */
/*  F. Reads still work                                                       */
/* -------------------------------------------------------------------------- */

console.log('\nF) Direct Appwrite reads are unaffected');

const sdkRead = await withSdkJwt(async (d) => {
  const { Query } = await import('appwrite');
  const result = await d.listDocuments(db, COLLECTIONS.customers, [Query.limit(5)]);
  return result.documents.length;
});
report(
  'F1  a signed-in staff JWT can still list a collection',
  sdkRead.ok,
  sdkRead.ok ? `listed ${sdkRead.value} document(s)` : `the read failed with ${sdkRead.status}`
);

const staffList = await withSdkJwt(async (d) => {
  const { Query } = await import('appwrite');
  const result = await d.listDocuments(db, COLLECTIONS.staff, [Query.limit(5)]);
  return result.documents.length;
});
report(
  'F2  reads still work on the admin-only staff collection for a non-admin',
  staffList.ok,
  staffList.ok ? `listed ${staffList.value} document(s)` : `the read failed with ${staffList.status}`
);

const serverRead = await listDocuments(COLLECTIONS.customers, { limit: 5 });
report('F3  the server can still read with the API key', serverRead.length > 0);

/* -------------------------------------------------------------------------- */
/*  G. The server is the only writer that succeeds                            */
/* -------------------------------------------------------------------------- */

console.log('\nG) The server write path');

const serverWriteId = mkId('g1');
const decision = await write(areaATech, 'customers', serverWriteId, {
  id: serverWriteId,
  name: 'Written through the server',
  areaId: AREA_A,
  status: 'Active',
});
const perms = permissionsForArea(decision.areaId, COLLECTIONS.customers);
await upsertDocument(COLLECTIONS.customers, serverWriteId, decision.payload, perms);
track(COLLECTIONS.customers, serverWriteId);
const readBack = await getDocument<{ name: string }>(COLLECTIONS.customers, serverWriteId);
report(
  'G1  a server-authorized write lands in Appwrite',
  readBack?.name === 'Written through the server',
  readBack ? `read back "${readBack.name}"` : 'the document was not found'
);
report(
  'G2  the permissions the server applied are read-only',
  perms.every((p) => p.startsWith('read(')),
  `got: ${JSON.stringify(perms)}`
);
report(
  'G3  no server-applied permission grants update or delete',
  !perms.some((p) => p.startsWith('update(') || p.startsWith('delete(')),
  `got: ${JSON.stringify(perms)}`
);

const forged = await write(areaATech, 'activityLogs', mkId('g4'), {
  id: 'x',
  userEmail: 'someone.else@trigonlinks.pk',
  userName: 'Someone Else',
  action: 'Forged',
  collection: 'customers',
});
report(
  'G4  the server overwrites the audit actor from the session',
  forged.payload.userEmail === areaATech.email,
  `actor became ${String(forged.payload.userEmail)}`
);

/* -------------------------------------------------------------------------- */
/*  H. The session is required                                                */
/* -------------------------------------------------------------------------- */

console.log('\nH) Session and identity requirements');

const asSubscriber = await (async () => {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    uid: 'subscriber:someone',
    appwriteSessionId: '',
    role: 'Customer',
    entityId: 'cust-999',
    name: 'A Subscriber',
    email: '',
    iat: now,
    exp: now + 3600,
  };
  const profile: AuthProfile = {
    uid: claims.uid,
    role: 'Customer',
    customerId: 'cust-999',
    name: 'A Subscriber',
    email: '',
    allowedSections: ['customer-portal'],
    allowedFunctions: [],
  };
  try {
    await authorizeWrite({
      claims,
      profile,
      collection: 'customers',
      documentId: customerA2,
      operation: 'upsert',
      incoming: { id: customerA2, name: 'x', areaId: AREA_A },
    });
    return { denied: false };
  } catch (error) {
    return { denied: error instanceof AuthError && error.status === 403 };
  }
})();
report('H1  a subscriber session cannot write operational data', asSubscriber.denied);

const asMismatched = await (async () => {
  const claims: SessionClaims = {
    uid: 'someone',
    appwriteSessionId: 'x',
    role: 'Staff',
    entityId: areaATech.staffId,
    name: 'x',
    email: '',
    iat: 0,
    exp: 9999999999,
  };
  try {
    await authorizeWrite({
      claims,
      // A profile claiming to be an admin the claims do not support.
      profile: { ...areaAAdmin.profile, role: 'Admin' },
      collection: 'staff',
      documentId: 'staff-admin',
      operation: 'upsert',
      incoming: { id: 'staff-admin', role: 'Admin' },
    });
    return { denied: false };
  } catch (error) {
    return { denied: error instanceof AuthError };
  }
})();
report(
  'H2  a claim/profile role mismatch is refused rather than trusted',
  asMismatched.denied
);

/* -------------------------------------------------------------------------- */
/*  I. The policy covers every synced collection                              */
/* -------------------------------------------------------------------------- */

console.log('\nI) Coverage of the policy table');
const { WRITE_POLICY, isWritableCollection } = await import('../server/write-authz');

/**
 * COLLECTIONS maps a camelCase key to the Appwrite collection id, and the
 * policy is keyed by the key, because that is what the write routes match on.
 * Comparing ids to keys would report a false gap.
 */
const missing = Object.keys(COLLECTIONS).filter((key) => !(key in WRITE_POLICY));
report(
  'I1  every synced collection has a write policy',
  missing.length === 0,
  missing.length ? `uncovered: ${missing.join(', ')}` : `${Object.keys(WRITE_POLICY).length} collections covered`
);

const orphanPolicies = Object.keys(WRITE_POLICY).filter((key) => !(key in COLLECTIONS));
report(
  'I2  the policy has no entry for a collection that does not exist',
  orphanPolicies.length === 0,
  orphanPolicies.length ? `orphaned: ${orphanPolicies.join(', ')}` : ''
);

const notRoutable = Object.keys(COLLECTIONS).filter((key) => !isWritableCollection(key));
report(
  'I3  the write route exposes exactly the collections with a policy',
  notRoutable.length === 0,
  notRoutable.length ? `not routable: ${notRoutable.join(', ')}` : ''
);

const nonReadOnly = Object.entries(COLLECTIONS).flatMap(([key, id]) => {
  const perms = permissionsForArea('some-area', id);
  return perms.some((p) => !p.startsWith('read(')) ? [key] : [];
});
report(
  'I4  no collection grants a write permission to any row',
  nonReadOnly.length === 0,
  nonReadOnly.length ? `still granting writes: ${nonReadOnly.join(', ')}` : ''
);

/**
 * The subscriber credential store is deliberately not in the policy table: it
 * is never written by a client. Guarding that explicitly, because adding it to
 * COLLECTIONS later would otherwise quietly widen the write surface.
 */
report(
  'I5  the subscriber credential store is not routable',
  !isWritableCollection('subscriberCredentials') &&
    !('subscriberCredentials' in WRITE_POLICY)
);

/* -------------------------------------------------------------------------- */
/*  J. Pre-existing rows carry no write grant                                 */
/* -------------------------------------------------------------------------- */

console.log('\nJ) Live row permissions (the part E alone cannot see)');

/**
 * Sections E and F only ever touch rows this script created, which already carry
 * the new read-only permissions. That makes them pass regardless of what the
 * rest of the database still looks like.
 *
 * This section therefore audits the rows that already existed. The sample row
 * found during the audit still had update("team:trigon_admin") and
 * update("team:area_area-1") on it, which means any technician in an area team
 * could still update and delete their area's customers straight from the
 * browser until `npm run provision` backfills the permissions.
 *
 * Read only: this inspects $permissions and never writes, so it cannot damage
 * live data even when the finding is a failure.
 */
const liveWriteGrants: string[] = [];
let rowsChecked = 0;
const unreadable: string[] = [];

/**
 * `$permissions` comes back on every document when the request is made with the
 * server API key, so no extra query is needed. Appwrite 2.3 has no `permissions`
 * query method, and asking for one makes the whole collection unreadable.
 */
for (const [key, collectionId] of Object.entries(COLLECTIONS)) {
  let documents: Array<{ $id: string; $permissions?: string[] }> = [];
  try {
    const page = await appwriteRequest<{ documents: typeof documents }>({
      method: 'GET',
      path: `${base}/${collectionId}/documents`,
      query: {
        'queries[]': JSON.stringify({ method: 'limit', values: [25] }),
      },
    });
    documents = page.documents ?? [];
  } catch (error) {
    unreadable.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  for (const doc of documents) {
    rowsChecked += 1;
    const bad = (doc.$permissions ?? []).filter((p) => p.startsWith('update(') || p.startsWith('delete('));
    if (bad.length) liveWriteGrants.push(`${key}/${doc.$id}: ${bad.join(' ')}`);
  }
}

/**
 * A collection that could not be read is not a pass. Silently skipping would let
 * a broken audit report "all clear" while checking nothing, which is exactly the
 * failure this section exists to prevent.
 */
report(
  'J1  every collection could be audited',
  unreadable.length === 0,
  unreadable.length ? unreadable.join('\n          ') : `${Object.keys(COLLECTIONS).length} collections read`
);

report(
  'J2  no pre-existing row grants update or delete to any team',
  liveWriteGrants.length === 0,
  liveWriteGrants.length
    ? `${liveWriteGrants.length} of ${rowsChecked} sampled rows still grant writes, e.g.\n          ${liveWriteGrants.slice(0, 3).join('\n          ')}`
    : `checked ${rowsChecked} rows across ${Object.keys(COLLECTIONS).length} collections`
);

/**
 * The collection level must not hand out create either. A staff team create
 * grant is what would let a browser invent rows, whatever the row permissions
 * say.
 */
const collectionsWithCreate: string[] = [];
for (const [key, collectionId] of Object.entries(COLLECTIONS)) {
  // Appwrite 2.3 returns the collection grants as `$permissions`. Reading
  // `permissions` here returned undefined, so this loop saw an empty list and
  // passed vacuously while the grants were unknown.
  const detail = await appwriteRequest<{
    $permissions?: string[];
    documentSecurity?: boolean;
  }>({
    method: 'GET',
    path: `/databases/${db}/collections/${collectionId}`,
  });
  const grants = detail.$permissions ?? [];
  if (grants.some((p) => !p.startsWith('read('))) {
    collectionsWithCreate.push(`${key} (${grants.join(' ')})`);
  }
  if (detail.documentSecurity === false) {
    collectionsWithCreate.push(`${key} (document security off)`);
  }
}
report(
  'J3  no collection grants a non-read collection permission',
  collectionsWithCreate.length === 0,
  collectionsWithCreate.length ? collectionsWithCreate.join(', ') : ''
);

/* -------------------------------------------------------------------------- */
/*  Summary                                                                   */
/* -------------------------------------------------------------------------- */

await cleanup();

console.log('\n' + '='.repeat(70));
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\n  Failures:');
  for (const f of failures) console.log(`   - ${f}`);
}
console.log('='.repeat(70));

process.exit(failed === 0 ? 0 : 1);
