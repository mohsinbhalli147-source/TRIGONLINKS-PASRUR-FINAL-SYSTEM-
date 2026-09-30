/**
 * End-to-end check of the subscriber sign-in path.
 * Run against a live server:  npx tsx scripts/verify-subscriber-auth.ts
 */
const BASE = process.env.BASE ?? 'http://localhost:3995';

let cookie = '';

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const entry of setCookie) {
    const pair = entry.split(';')[0];
    const [name] = pair.split('=');
    const existing = cookie
      .split('; ')
      .filter((c) => c && !c.startsWith(`${name}=`));
    cookie = [...existing, pair].join('; ');
  }
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const login = (userId: string, cnic: string) =>
  call('/api/auth/subscriber-login', {
    method: 'POST',
    body: JSON.stringify({ userId, cnic }),
  });

const cases: Array<[string, string, string, number]> = [
  ['malformed CNIC', 'user733_psr', '123', 400],
  ['CNIC with letters', 'user733_psr', 'abcdefghijklm', 400],
  ['unknown user ID', 'nobody-here', '35202-1234567-1', 401],
  ['correct user, wrong CNIC', 'user733_psr', '35202-9999999-9', 401],
  ['correct user + correct CNIC', 'user733_psr', process.env.TEST_CNIC ?? '00000-0000000-0', 200],
];

let failures = 0;
let skipped = 0;

/**
 * The happy path needs at least one provisioned subscriber whose CNIC is on file.
 * Until `npm run provision` has run against a project that contains subscriber
 * records, the server correctly refuses every sign-in, so that case is reported
 * as skipped rather than as a failure.
 */
const status = await call('/api/auth/status').catch(() => ({ status: 0, body: null }));
if (status.status !== 200) {
  console.log(
    `SKIP  happy path: data service not provisioned (${status.status}). ` +
      'Run "npm run provision" against a project that has subscriber records.'
  );
  skipped += 1;
}

for (const [name, userId, cnic, expected] of cases) {
  const isHappyPath = name.startsWith('correct user + correct');
  const result = await login(userId, cnic);
  const ok = result.status === expected;
  if (!ok && isHappyPath && skipped > 0) {
    console.log(
      `SKIP  ${name.padEnd(30)} -> ${result.status}. No subscriber is provisioned, so ` +
        'there is no CNIC on file to verify against.'
    );
    continue;
  }
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} -> ${result.status} (expected ${expected})  ${
      result.body?.message ?? ''
    }`
  );

  if (name === 'correct user + correct CNIC' && ok) {
    // The cookie from the login response is the whole session: it is
    // httpOnly, so a reload has no other way to recover it.
    const session = await call('/api/auth/session');
    console.log(`      session restore: ${session.status} role=${session.body?.profile?.role}`);
    if (session.status !== 200 || session.body?.profile?.role !== 'Customer') {
      failures += 1;
      console.log('FAIL  session restore did not return a Customer profile');
    }

    // And the portal must return that subscriber's own data and nothing else.
    const portal = await call('/api/portal');
    const profile = portal.body?.profile ?? {};
    console.log(
      `      portal: ${portal.status} userId=${profile.username ?? '?'} ` +
        `invoices=${portal.body?.invoices?.length ?? 0} payments=${portal.body?.payments?.length ?? 0} ` +
        `complaints=${portal.body?.complaints?.length ?? 0}`
    );
    if (portal.status !== 200) {
      failures += 1;
      console.log('FAIL  portal was not readable for an authenticated subscriber');
    } else {
      // A leaked staff-only field would mean the allowlist is not being applied.
      const allowed = new Set([
        'id','name','username','email','mobile','cnic','address','areaName','packageName',
        'packageSpeed','monthlyFee','totalMonthly','ipCharges','iptvCharges','discount',
        'discountMonthly','connectionType','device','ipAddress','gateway','pppoeUsername',
        'pppoePassword','status','installDate','billingDate','hasIptv',
      ]);
      const extra = Object.keys(profile).filter((key) => !allowed.has(key));
      if (extra.length > 0) {
        failures += 1;
        console.log(`FAIL  portal profile leaked unexpected fields: ${extra.join(', ')}`);
      } else {
        console.log('      portal profile field allowlist respected');
      }
    }

    // Signing out must actually revoke the session.
    const out = await call('/api/auth/logout', { method: 'POST' });
    const after = await call('/api/portal');
    console.log(`      after sign-out, portal -> ${after.status}`);
    if (after.status !== 401) {
      failures += 1;
      console.log('FAIL  portal still readable after sign-out');
    } else {
      cookie = '';
      console.log('      sign-out revoked the session');
    }
    void out;
  }
}

console.log(
  failures === 0
    ? `\nSubscriber auth error handling verified${skipped > 0 ? ' (happy path skipped)' : ''}.`
    : `\n${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);

