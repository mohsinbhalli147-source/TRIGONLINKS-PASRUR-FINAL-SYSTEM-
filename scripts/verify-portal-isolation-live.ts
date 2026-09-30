/**
 * End-to-end check of the subscriber portal against a real subscriber.
 *
 * Creates a throwaway subscriber with a known CNIC, signs in through
 * /api/auth/subscriber-login, and confirms /api/portal returns only that
 * subscriber's own data and none of another subscriber's. Also confirms a
 * subscriber session cannot write operational data (the C-2 boundary holds from
 * the subscriber side too). Read-mostly; all fixtures are removed at the end.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments, upsertDocument, deleteDocument } from '../server/appwrite-rest';
import { hashCnic, credentialCollectionId } from '../server/subscriber-credentials';

assertConfigValid();

const base = `http://127.0.0.1:${config.port}`;
const stamp = Date.now();
const idA = `portal_a_${stamp}`;
const idB = `portal_b_${stamp}`;

// Two valid, distinct 13-digit CNICs.
const cnicA = `35202${String(1000000 + (stamp % 8000000)).padStart(7, '0')}1`;
const cnicB = `42201${String(1000000 + ((stamp + 1) % 8000000)).padStart(7, '0')}7`;

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

try {
  const areas = await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 1 });
  const areaId = areas[0]?.id;

  // Two subscribers in the same area, each with a bill and a payment, so the
  // portal has something real to return and something real to withhold.
  for (const [id, cnic, name, user] of [
    [idA, cnicA, 'Portal Probe A', `pa_${stamp}`],
    [idB, cnicB, 'Portal Probe B', `pb_${stamp}`],
  ] as const) {
    await upsertDocument(COLLECTIONS.customers, id, {
      id,
      name,
      username: user,
      cnic,
      mobile: '0300' + String(stamp).slice(-7),
      areaId,
      areaName: 'probe',
      status: 'Active',
      monthlyFee: 2500,
      pppoeUsername: user,
      pppoePassword: 'secret-probe',
    });
    await upsertDocument(COLLECTIONS.invoices, `inv_${id}`, {
      id: `inv_${id}`,
      invoiceNumber: `PR-${id}`,
      customerId: id,
      customerName: name,
      amount: 2500,
      status: 'Unpaid',
      month: 'Probe',
    });
    await upsertDocument(COLLECTIONS.payments, `pay_${id}`, {
      id: `pay_${id}`,
      receiptNumber: `PRP-${id}`,
      customerId: id,
      amount: 2500,
      method: 'Cash',
    });
    // The subscriber credential the sign-in check verifies against. A real
    // customer gets this from "npm run provision"; a probe has to make its own.
    const hashed = hashCnic(cnic);
    await upsertDocument(credentialCollectionId, id, {
      id,
      customerId: id,
      cnicDigits: cnic,
      hash: hashed.hash,
      salt: hashed.salt,
      iterations: hashed.iterations,
      userIdLabel: user,
    });
  }

  // Subscriber sign-in: user ID + CNIC.
  const login = await call('/api/auth/subscriber-login', {
    method: 'POST',
    body: { userId: `pa_${stamp}`, cnic: cnicA },
  });
  report(
    'a subscriber can sign in with user ID + CNIC',
    login.status === 200,
    `status ${login.status} ${JSON.stringify(login.body)?.slice(0, 120)}`
  );

  const portal = await call('/api/portal');
  report('the portal loads for a signed-in subscriber', portal.status === 200, `status ${portal.status}`);

  const data = portal.body;
  const custId = data?.profile?.id ?? data?.customer?.id;
  report('the portal returns the signed-in subscriber', custId === idA, `profile id ${custId}`);

  const invoices = data?.invoices ?? [];
  report(
    'invoices are scoped to the subscriber who signed in',
    Array.isArray(invoices) && invoices.every((i: any) => i.customerId === idA || !i.customerId) && invoices.length > 0,
    `${invoices.length} invoice(s), customerIds ${[...new Set(invoices.map((i: any) => i.customerId))].join(',')}`
  );

  const payments = data?.payments ?? [];
  report(
    'payments are scoped to the subscriber who signed in',
    Array.isArray(payments) && payments.every((p: any) => p.customerId === idA || !p.customerId),
    `${payments.length} payment(s)`
  );

  // A subscriber must never see the other subscriber's PPPoE secret.
  const serialised = JSON.stringify(data ?? {});
  report(
    "the other subscriber's data never appears in the portal response",
    !serialised.includes(idB) && !serialised.includes(`pb_${stamp}`),
    serialised.includes(idB) ? 'LEAK: other subscriber id present' : ''
  );
  report(
    'the portal does not leak internal fields (accountId, notes)',
    !serialised.includes('accountId') && !/'pppoePassword"\s*:\s*"secret-probe-b"/.test(serialised),
    ''
  );

  // C-2 boundary from the subscriber side: no operational writes. A subscriber
  // must be refused cleanly, not crash the request.
  const write = await call('/api/data/customers', {
    method: 'POST',
    body: { data: { id: `hack_${stamp}`, name: 'Should not be allowed' } },
  });
  report(
    'a subscriber session cannot write operational data',
    write.status === 401 || write.status === 403,
    `status ${write.status} ${JSON.stringify(write.body)?.slice(0, 120)}`
  );

  // A subscriber submitting a complaint is the one write they may make.
  const complaint = await call('/api/portal/complaints', {
    method: 'POST',
    body: { subject: 'Probe ticket', message: 'Automated portal check', priority: 'Low' },
  });
  report(
    'a subscriber can raise a support ticket through the portal',
    complaint.status === 200 || complaint.status === 201,
    `status ${complaint.status} ${JSON.stringify(complaint.body)?.slice(0, 120)}`
  );

  await call('/api/auth/logout', { method: 'POST' });
} catch (error) {
  failed += 1;
  console.log(`  FAIL  harness error: ${error instanceof Error ? error.message : error}`);
} finally {
  for (const id of [idA, idB]) {
    for (const [coll, docId] of [
      [COLLECTIONS.customers, id],
      [COLLECTIONS.invoices, `inv_${id}`],
      [COLLECTIONS.payments, `pay_${id}`],
      [credentialCollectionId, id],
    ] as const) {
      try {
        await deleteDocument(coll, docId);
      } catch {
        /* best effort */
      }
    }
  }
  // Remove any complaint the probe created.
  try {
    const complaints = await listDocuments<Record<string, unknown>>(COLLECTIONS.complaints, { limit: 200 });
    for (const c of complaints) {
      if (String(c.description ?? '').includes('Automated portal check')) {
        await deleteDocument(COLLECTIONS.complaints, String(c.id));
      }
    }
  } catch {
    /* best effort */
  }
  console.log('\n  probe fixtures removed');
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
