/**
 * Staff and subscriber sessions must not overwrite each other.
 *
 * A cookie is scoped to a host, not a port, so the staff panel on 3010 and the
 * subscriber app on 5174 share one cookie jar. They also share one cookie *name*.
 * Signing in as a subscriber therefore replaced the staff session, and every
 * panel read came back 403 for a Customer role.
 *
 * That was not only an error message. The panel treats a 403 on a read as a lost
 * session and drops the user, which unmounts whatever screen was open - so an
 * operator editing a staff member had the form disappear under them as soon as
 * they typed. The symptom was "the field deselects after one character".
 *
 * Needs the server running.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments, upsertDocument, deleteDocument } from '../server/appwrite-rest';
import { credentialCollectionId, hashCnic } from '../server/subscriber-credentials';
import { createUser, appwriteRequest } from '../server/appwrite-rest';

assertConfigValid();

const base = `http://127.0.0.1:${config.port}`;
const stamp = Date.now();
const subscriberId = `crossover_${stamp}`;
const staffEmail = `crossover-${stamp}@verify.invalid`;
const password = 'Aa1bbbbbbbbbbbb';
const cnic = `35202${String(1000000 + (stamp % 8000000)).padStart(7, '0')}1`;

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

/** One jar, exactly as a browser has: cookies are not scoped to a port. */
const jar = new Map<string, string>();
function jarCookieNames(): string[] {
  return [...jar.keys()].filter((k) => k !== 'a_session_x');
}

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
  const areas = await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 1 });
  const areaId = areas[0].id;

  const staff = await createUser({
    email: staffEmail,
    password,
    name: 'Cookie Crossover Probe',
    labels: ['trigon', 'rolestaff'],
  });
  staffUserId = staff.$id;
  staffId = `crossover_staff_${stamp}`;
  await upsertDocument(COLLECTIONS.staff, staffId, {
    id: staffId,
    name: 'Cookie Crossover Probe',
    email: staffEmail,
    emailLower: staffEmail.toLowerCase(),
    role: 'Technician',
    status: 'active',
    accountId: staffUserId,
    allowedSections: ['dashboard', 'customers'],
    allowedFunctions: ['add_customers'],
    assignedAreaIds: [areaId],
  });

  await upsertDocument(COLLECTIONS.customers, subscriberId, {
    id: subscriberId,
    name: 'Crossover Subscriber',
    username: `cx_${stamp}`,
    cnic,
    mobile: '0300' + String(stamp).slice(-7),
    areaId,
    status: 'Active',
  });
  const hashed = hashCnic(cnic);
  await upsertDocument(credentialCollectionId, subscriberId, {
    id: subscriberId,
    customerId: subscriberId,
    cnicDigits: cnic,
    hash: hashed.hash,
    salt: hashed.salt,
    iterations: hashed.iterations,
    userIdLabel: `cx_${stamp}`,
  });

  // Staff signs in first.
  const staffLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { identifier: staffEmail, password },
  });
  report('staff sign in', staffLogin.status === 200, `status ${staffLogin.status}`);
  const afterStaff = jarCookieNames();

  // A staff read works.
  const staffRead = await call('/api/data/customers');
  report('a staff read works', staffRead.status === 200, `status ${staffRead.status}`);

  // Now a subscriber signs in - in the same jar, as a browser would.
  const subLogin = await call('/api/auth/subscriber-login', {
    method: 'POST',
    body: { userId: `cx_${stamp}`, cnic },
  });
  report('subscriber sign in', subLogin.status === 200, `status ${subLogin.status}`);

  const afterSub = jarCookieNames();
  report(
    'subscriber sign-in adds a cookie rather than replacing the staff one',
    afterStaff.every((name) => afterSub.includes(name)),
    `before: ${afterStaff.join(', ')} | after: ${afterSub.join(', ')}`
  );
  report(
    'the two apps use different cookie names',
    afterSub.some((n) => n.includes('staff')) && afterSub.some((n) => n.includes('subscriber')),
    afterSub.join(', ')
  );

  // The staff session must still work after the subscriber signed in.
  const staffReadAfter = await call('/api/data/customers');
  report(
    'the staff session survives a subscriber signing in',
    staffReadAfter.status === 200,
    `status ${staffReadAfter.status} - a 403 here is what closed the open form`
  );

  // And the subscriber session must still work too.
  const portal = await call('/api/portal');
  report(
    'the subscriber session works at the same time',
    portal.status === 200,
    `status ${portal.status}`
  );

  // A staff cookie must not satisfy a subscriber endpoint, and vice versa.
  const subOnly = new Map([...jar].filter(([k]) => k.includes('subscriber')));
  const saved = new Map(jar);
  jar.clear();
  for (const [k, v] of subOnly) jar.set(k, v);
  const staffEndpoint = await call('/api/data/customers');
  report(
    'a subscriber session cannot use a staff endpoint',
    staffEndpoint.status === 401 || staffEndpoint.status === 403,
    `status ${staffEndpoint.status}`
  );
  jar.clear();
  for (const [k, v] of saved) jar.set(k, v);

  await call('/api/auth/logout', { method: 'POST' });
} catch (error) {
  failed += 1;
  console.log(`  FAIL  harness error: ${error instanceof Error ? error.message : error}`);
} finally {
  for (const [coll, docId] of [
    [COLLECTIONS.customers, subscriberId],
    [credentialCollectionId, subscriberId],
    [COLLECTIONS.staff, staffId],
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

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
