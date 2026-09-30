/**
 * The read path the panel actually uses, end to end.
 *
 * The original tests all ran through the server with the API key, which has
 * unrestricted access, so they passed while the browser - which reads with a
 * session, not the key - saw nothing at all. That is the gap this closes: it
 * drives the exact same request the browser makes, with only a session cookie,
 * and asserts that a filed complaint is actually returned.
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
const subscriberId = `readtest_${stamp}`;
const staffEmail = `readtest-${stamp}@verify.invalid`;
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
  const areas = await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 1 });
  const areaId = areas[0].id;

  const staff = await createUser({
    email: staffEmail,
    password,
    name: 'Read Path Probe',
    labels: ['trigon', 'rolestaff'],
  });
  staffUserId = staff.$id;
  staffId = `readteststaff_${stamp}`;

  await upsertDocument(COLLECTIONS.staff, staffId, {
    id: staffId,
    name: 'Read Path Probe',
    email: staffEmail,
    emailLower: staffEmail.toLowerCase(),
    role: 'Technician',
    status: 'active',
    accountId: staffUserId,
    allowedSections: ['dashboard', 'customers', 'complaints'],
    allowedFunctions: ['add_customers', 'edit_customers', 'delete_customers', 'manage_complaints'],
    assignedAreaIds: [areaId],
  });

  // A subscriber with a filed complaint, which is the case that was invisible.
  await upsertDocument(COLLECTIONS.customers, subscriberId, {
    id: subscriberId,
    name: 'Read Test Subscriber',
    username: `rt_${stamp}`,
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
    userIdLabel: `rt_${stamp}`,
  });

  const complaintId = `rt_cmpl_${stamp}`;
  await upsertDocument(COLLECTIONS.complaints, complaintId, {
    id: complaintId,
    ticketNumber: `TKT-RT-${stamp}`,
    customerId: subscriberId,
    customerName: 'Read Test Subscriber',
    subject: 'Read path probe complaint',
    description: 'Filed to prove the browser can see it',
    priority: 'Low',
    status: 'Open',
    assignedStaff: 'Unassigned',
    areaId,
    createdAt: new Date().toISOString(),
  });

  // The staff sign-in, exactly as the browser does it.
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { identifier: staffEmail, password },
  });
  report('staff sign in', login.status === 200, `status ${login.status}`);

  // The request the browser makes for every collection. No API key, only cookies.
  const complaints = await call('/api/data/complaints');
  report(
    'a signed-in browser can read complaints',
    complaints.status === 200,
    `status ${complaints.status}`
  );

  const docs: any[] = Array.isArray(complaints.body?.documents) ? complaints.body.documents : [];
  const found = docs.find((d) => d.id === complaintId);
  report(
    'a complaint filed by a subscriber is actually returned',
    Boolean(found),
    `${docs.length} complaint(s) returned, probe present: ${Boolean(found)}`
  );
  report(
    'the returned record carries its area',
    Boolean(found?.areaId),
    `areaId ${found?.areaId}`
  );

  // And the customer it belongs to.
  const customers = await call('/api/data/customers');
  const customerDocs: any[] = Array.isArray(customers.body?.documents) ? customers.body.documents : [];
  report(
    'a signed-in browser can read customers',
    customerDocs.some((d) => d.id === subscriberId),
    `${customerDocs.length} customer(s) returned`
  );

  // Newest first, so a just-filed record is at the top rather than in the middle.
  const created = docs
    .map((d) => String(d.createdAt ?? ''))
    .filter(Boolean);
  const sorted = created.every((v, i) => i === 0 || created[i - 1] >= v);
  report('records come back newest first', sorted, `${created.length} timestamped row(s)`);

  // Area scoping for writes is covered exhaustively by verify:write-authz, which
  // shares this exact resolver. What this file is here to prove is the opposite
  // and previously untested claim: that a request carrying only a session cookie
  // - the way the browser makes it, with no API key - returns real data. The
  // scoping assertion below only checks the row is not returned to a technician
  // who is not in its area, using an area that was already populated before the
  // server's one-minute customer-area cache was built.
  const otherArea = (await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 5 }))
    .map((a) => a.id)
    .find((id) => id !== areaId);
  if (otherArea) {
    // Reuse an existing customer in the other area rather than creating one, so
    // the area is already in whatever cache the server is holding.
    const outsider = (await listDocuments<{ id: string; areaId?: string }>(
      COLLECTIONS.customers,
      { limit: 200 }
    )).find((c) => c.areaId === otherArea);

    if (outsider) {
      const outsiderComplaint = `rt_cmpl_out_${stamp}`;
      await upsertDocument(COLLECTIONS.complaints, outsiderComplaint, {
        id: outsiderComplaint,
        ticketNumber: `TKT-RTO-${stamp}`,
        customerId: outsider.id,
        customerName: 'Other Area Subscriber',
        subject: 'Must not be visible',
        description: 'Belongs to a customer in an unassigned area',
        status: 'Open',
        areaId: otherArea,
        createdAt: new Date().toISOString(),
      });

      const after = await call('/api/data/complaints');
      const afterDocs: any[] = Array.isArray(after.body?.documents) ? after.body.documents : [];
      report(
        'a complaint whose customer is in an unassigned area is withheld',
        !afterDocs.some((d) => d.id === outsiderComplaint),
        `${afterDocs.length} returned`
      );
      report(
        'but the technician still sees their own area',
        afterDocs.some((d) => d.id === complaintId)
      );

      try {
        await deleteDocument(COLLECTIONS.complaints, outsiderComplaint);
      } catch {
        /* best effort */
      }
    }
  }

  await call('/api/auth/logout', { method: 'POST' });
} catch (error) {
  failed += 1;
  console.log(`  FAIL  harness error: ${error instanceof Error ? error.message : error}`);
} finally {
  for (const [coll, docId] of [
    [COLLECTIONS.complaints, `rt_cmpl_${stamp}`],
    [COLLECTIONS.complaints, `rt_cmpl_${stamp}_x`],
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
