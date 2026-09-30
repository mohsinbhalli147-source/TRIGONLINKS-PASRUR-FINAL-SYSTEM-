/**
 * A subscriber added in the panel must be able to sign in immediately.
 *
 * Two gaps used to sit between an operator adding a connection and that person
 * being able to use the app:
 *
 *   - the server cached the user-ID -> subscriber index for five minutes and
 *     nothing invalidated it, so a brand new subscriber was "Incorrect user ID";
 *   - the PBKDF2 credential was only ever written by `npm run provision`, so even
 *     once the cache expired there was no hash to verify against.
 *
 * This creates a subscriber through the normal authenticated write path and
 * signs in with no provisioning step in between. It needs the server running.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, upsertDocument, deleteDocument, getDocument } from '../server/appwrite-rest';
import { credentialCollectionId } from '../server/subscriber-credentials';
import { createUser, appwriteRequest } from '../server/appwrite-rest';
import { upsertDocument as serverUpsert } from '../server/appwrite-rest';

assertConfigValid();

const base = `http://127.0.0.1:${config.port}`;
const stamp = Date.now();
const userId = `fresh_${stamp}`;
const cnic = `35202${String(1000000 + (stamp % 8000000)).padStart(7, '0')}1`;
const password = 'Aa1bbbbbbbbbbbb';
const email = `fresh-${stamp}@verify.invalid`;

let passed = 0;
let failed = 0;
const report = (name: string, ok: boolean, detail = ''): void => {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
};

const jar = new Map<string, string>();
async function call(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

let staffUserId = '';
let staffId = '';
try {
  const areas = await listAreas();
  const staff = await createUser({
    email,
    password,
    name: 'Fresh Subscriber Probe',
    labels: ['trigon', 'rolestaff'],
  });
  staffUserId = staff.$id;
  staffId = `freshstaff_${stamp}`;

  await upsertDocument(COLLECTIONS.staff, staffId, {
    id: staffId,
    name: 'Fresh Subscriber Probe',
    email,
    emailLower: email.toLowerCase(),
    role: 'Technician',
    status: 'active',
    accountId: staffUserId,
    allowedSections: ['dashboard', 'customers'],
    allowedFunctions: ['add_customers', 'edit_customers', 'delete_customers'],
    assignedAreaIds: [areas],
  });

  const staffLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { identifier: email, password },
  });
  report('the probe staff account signs in', staffLogin.status === 200, `status ${staffLogin.status}`);

  // Create the subscriber through the ordinary write path, as an operator would.
  const created = await call('/api/data/customers', {
    method: 'POST',
    body: { data: { id: userId, name: 'Fresh Subscriber', username: userId, cnic, mobile: '0300' + String(stamp).slice(-7), areaId: areas, status: 'Active', monthlyFee: 2500 } },
  });
  report(
    'an operator can add a subscriber through the write path',
    created.status === 200 || created.status === 201,
    `status ${created.status} ${JSON.stringify(created.body)?.slice(0, 120)}`
  );

  // The credential must now exist without anyone running provision.
  const credential = await getDocument<Record<string, unknown>>(credentialCollectionId, userId);
  report(
    'the sign-in credential was created by the write itself',
    Boolean(credential && (credential.hash as string) && (credential.salt as string)),
    credential ? 'hash + salt present' : 'no credential row'
  );

  // Sign out the operator so the subscriber is a fresh, separate session.
  await call('/api/auth/logout', { method: 'POST' });
  jar.clear();

  // No provisioning step, no waiting. Sign in straight away.
  const subLogin = await call('/api/auth/subscriber-login', {
    method: 'POST',
    body: { userId, cnic },
  });
  report(
    'the new subscriber can sign in immediately, with no provisioning run',
    subLogin.status === 200,
    `status ${subLogin.status} ${JSON.stringify(subLogin.body)?.slice(0, 140)}`
  );

  if (subLogin.status === 200) {
    const portal = await call('/api/portal');
    report(
      'and the portal serves their own record',
      portal.status === 200 && portal.body?.profile?.id === userId,
      `profile id ${portal.body?.profile?.id}`
    );
    await call('/api/auth/logout', { method: 'POST' });
  }
} catch (error) {
  failed += 1;
  console.log(`  FAIL  harness error: ${error instanceof Error ? error.message : error}`);
} finally {
  for (const [coll, docId] of [
    [COLLECTIONS.customers, userId],
    [COLLECTIONS.staff, staffId],
    [credentialCollectionId, userId],
  ] as const) {
    try {
      await deleteDocument(coll, docId);
    } catch {
      /* best effort */
    }
  }
  if (staffUserId) {
    try {
      await appwriteRequest({ method: 'DELETE', path: `/users/${staffUserId}` });
    } catch {
      /* best effort */
    }
  }
  console.log('\n  probe fixtures removed');
}

async function listAreas(): Promise<string> {
  const { listDocuments } = await import('../server/appwrite-rest');
  const areas = await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 1 });
  return areas[0]?.id as string;
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
