/**
 * Confirms a subscriber can only ever see their own records.
 *   npx tsx scripts/verify-portal-isolation.ts
 *
 * Logs in as two different subscribers and checks that neither response contains
 * the other's invoices, payments or complaints.
 */
import 'dotenv/config';
import { COLLECTIONS, listDocuments } from '../server/appwrite-rest';

const BASE = process.env.BASE ?? 'http://localhost:3010';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

async function login(userId: string, cnic: string) {
  let cookie = '';
  const response = await fetch(`${BASE}/api/auth/subscriber-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, cnic }),
  });
  for (const entry of response.headers.getSetCookie?.() ?? []) {
    const pair = entry.split(';')[0];
    const name = pair.split('=')[0];
    cookie = [
      ...cookie.split('; ').filter((c) => c && !c.startsWith(`${name}=`)),
      pair,
    ].join('; ');
  }
  if (!response.ok) return { cookie, profile: null as Record<string, unknown> | null };
  const body = (await response.json()) as { profile: Record<string, unknown> };
  return { cookie, profile: body.profile };
}

async function portal(cookie: string) {
  const response = await fetch(`${BASE}/api/portal`, { headers: { Cookie: cookie } });
  if (!response.ok) return null;
  return (await response.json()) as {
    profile: Record<string, unknown>;
    invoices: Array<Record<string, unknown>>;
    payments: Array<Record<string, unknown>>;
    complaints: Array<Array<Record<string, unknown>> extends never ? never : Record<string, unknown>>;
  };
}

const rows = await listDocuments<Record<string, any>>(COLLECTIONS.customers, { limit: 40 });
const usable = rows.filter(
  (r) => r.status === 'Active' && String(r.cnic ?? '').replace(/\D/g, '').length === 13
);
if (usable.length < 2) {
  console.log('Need two usable subscribers to test isolation.');
  process.exit(0);
}

const [a, b] = usable;
const sessionA = await login(String(a.username), String(a.cnic));
const sessionB = await login(String(b.username), String(b.cnic));

check('subscriber A signed in', Boolean(sessionA.profile));
check('subscriber B signed in', Boolean(sessionB.profile));

const dataA = await portal(sessionA.cookie);
const dataB = await portal(sessionB.cookie);

if (!dataA || !dataB) {
  console.log('Could not read a portal.');
  process.exit(1);
}

check('A sees its own record', dataA.profile.username === a.username, `(${a.username})`);
check('B sees its own record', dataB.profile.username === b.username, `(${b.username})`);
check(
  'A does not see B\'s identity',
  dataA.profile.username !== b.username,
  `A saw ${String(dataA.profile.username)}`
);

// The decisive check: compare what the portal returned against the database.
// The portal deliberately omits `customerId` (a subscriber has no business
// seeing another row's foreign key), so ownership cannot be checked from the
// response alone - it has to be checked against server-side truth.
const inv = await listDocuments<Record<string, any>>(COLLECTIONS.invoices, { limit: 5000 });
const cmp = await listDocuments<Record<string, any>>(COLLECTIONS.complaints, { limit: 5000 });
const pay = await listDocuments<Record<string, any>>(COLLECTIONS.payments, { limit: 5000 });

const idsOwnedBy = (all: Array<Record<string, any>>, customerId: unknown) =>
  new Set(all.filter((r) => r.customerId === customerId).map((r) => r.id));

const sameSet = (got: Array<Record<string, unknown>>, expected: Set<unknown>) => {
  if (got.length !== expected.size) return false;
  const gotIds = new Set(got.map((r) => r.id));
  if (gotIds.size !== got.length) return false;
  for (const id of gotIds) if (!expected.has(id)) return false;
  return true;
};

const aIdVal = dataA.profile.id;
const bIdVal = dataB.profile.id;

check(
  "A's invoices are exactly A's own invoices in the database",
  sameSet(dataA.invoices, idsOwnedBy(inv, aIdVal)),
  `(${dataA.invoices.length} returned)`
);
check(
  "B's invoices are exactly B's own invoices in the database",
  sameSet(dataB.invoices, idsOwnedBy(inv, bIdVal)),
  `(${dataB.invoices.length} returned)`
);
check(
  "A's complaints are exactly A's own complaints in the database",
  sameSet(dataA.complaints, idsOwnedBy(cmp, aIdVal)),
  `(${dataA.complaints.length} returned)`
);
check(
  "A's payments are exactly A's own payments in the database",
  sameSet(dataA.payments, idsOwnedBy(pay, aIdVal)),
  `(${dataA.payments.length} returned)`
);

// A subscriber should not even be shown the foreign key.
const leakedKeys = [
  ...dataA.invoices,
  ...dataA.payments,
  ...dataA.complaints,
].filter((r) => 'customerId' in r);
check('portal rows omit customerId entirely', leakedKeys.length === 0);

// A's own id must never appear in B's payload.
const aId = String(dataA.profile.id);
const bBlob = JSON.stringify(dataB);
check('B\'s response never contains A\'s customer id', !bBlob.includes(aId));

// And no portal may contain another subscriber's username.
const aName = String(dataA.profile.username);
const bName = String(dataB.profile.username);
check('B\'s response never contains A\'s username', !bBlob.includes(`"${aName}"`));
check(
  'A\'s response never contains B\'s username',
  !JSON.stringify(dataA).includes(`"${bName}"`)
);

// Finally: a cookie belonging to a subscriber must not work on staff endpoints.
const staffProbe = await fetch(`${BASE}/api/customers/${dataA.profile.id}/credentials`, {
  headers: { Cookie: sessionA.cookie },
});
check(
  'subscriber cannot use the staff credentials endpoint',
  staffProbe.status === 403,
  `-> ${staffProbe.status}`
);

console.log(failures === 0 ? '\nPortal isolation verified.' : `\n${failures} isolation check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
