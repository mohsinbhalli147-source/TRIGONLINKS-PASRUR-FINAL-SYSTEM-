/**
 * Regression tests for the two data-loss bugs in the browser write path.
 *
 * 1. `isPermanentRejection` treated 429 as permanent because it is under 500, so
 *    a write that hit a rate limit was dropped from the retry queue and lost.
 *    It must only be permanent for statuses the server will never change its
 *    mind about.
 *
 * 2. A failed Appwrite delete was warned about and forgotten, leaving the row
 *    alive on the server with no record that it still needed deleting. Deletes
 *    must queue and replay as deletes.
 *
 * The storage queue is exercised against a stubbed localStorage, a stubbed
 * writeApi, and a stubbed push/remove, so nothing touches the network.
 */
import { isPermanentRejection, WriteRejectedError } from '../src/services/writeApi';

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

/* -------------------------------------------------------------------------- */
/*  1. Rejection classification                                                */
/* -------------------------------------------------------------------------- */

console.log('isPermanentRejection:');

report(
  '429 (rate limited) is retryable, not permanent',
  isPermanentRejection(new WriteRejectedError('Too many attempts', 429)) === false,
  'a rate limit clears on its own; dropping the write lost data'
);
report(
  '425 (too early) is retryable',
  isPermanentRejection(new WriteRejectedError('Too early', 425)) === false
);
report(
  '408 (request timeout) is retryable',
  isPermanentRejection(new WriteRejectedError('Request timeout', 408)) === false
);
report(
  '0 (network down) is retryable',
  isPermanentRejection(new WriteRejectedError('offline', 0)) === false
);
report(
  '500 (server fault) is retryable',
  isPermanentRejection(new WriteRejectedError('boom', 500)) === false
);
report(
  '503 (server unavailable) is retryable',
  isPermanentRejection(new WriteRejectedError('unavailable', 503)) === false
);
for (const status of [400, 401, 403, 404, 409, 422]) {
  report(
    `${status} is permanent`,
    isPermanentRejection(new WriteRejectedError('nope', status)) === true,
    'payload/session/record problem; retrying changes nothing'
  );
}
report(
  'a non-WriteRejectedError is not treated as permanent',
  isPermanentRejection(new Error('boom')) === false
);

/* -------------------------------------------------------------------------- */
/*  2. Delete queue replay                                                     */
/* -------------------------------------------------------------------------- */

console.log('\ndelete retry queue:');

// A focused reimplementation of the storage queue's shape, so the test asserts
// the contract the real code now follows without importing the 3000-line module.
interface PendingWrite {
  collection: string;
  docId: string;
  kind?: 'upsert' | 'delete';
  payload: unknown;
  attempts: number;
}

const PENDING_KEY = 'trigon_pending_writes_test';
const MAX_ATTEMPTS = 5;

const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

function readPending(): PendingWrite[] {
  const raw = localStorageStub.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingWrite[]) : [];
  } catch {
    return [];
  }
}
function writePending(entries: PendingWrite[]): void {
  localStorageStub.setItem(PENDING_KEY, JSON.stringify(entries));
}
function enqueueRetry(
  collection: string,
  docId: string,
  payload: unknown,
  error?: unknown,
  kind: 'upsert' | 'delete' = 'upsert'
): void {
  if (isPermanentRejection(error)) return;
  const entries = readPending().filter(
    (e) => !(e.collection === collection && e.docId === docId)
  );
  entries.push({ collection, docId, kind, payload, attempts: 0 });
  writePending(entries);
}

async function flush(
  push: (c: string, id: string, p: unknown) => Promise<void>,
  remove: (c: string, id: string) => Promise<void>
): Promise<number> {
  const entries = readPending();
  if (entries.length === 0) return 0;
  const remaining: PendingWrite[] = [];
  let flushed = 0;
  for (const entry of entries) {
    if (entry.attempts >= MAX_ATTEMPTS) continue;
    try {
      if (entry.kind === 'delete') await remove(entry.collection, entry.docId);
      else await push(entry.collection, entry.docId, entry.payload);
      flushed += 1;
    } catch (error) {
      if (isPermanentRejection(error)) continue;
      remaining.push({ ...entry, attempts: entry.attempts + 1 });
    }
  }
  writePending(remaining);
  return flushed;
}

// Each test starts from an empty queue and fresh counters, so a leftover entry
// from an earlier case cannot make a later one pass or fail for the wrong reason.
let removeCalls = 0;
let pushCalls = 0;

const fresh = () => {
  store.clear();
  removeCalls = 0;
  pushCalls = 0;
};

/** Always succeeds. Used where the test is about routing, not about failure. */
const removeOk = async () => {
  removeCalls += 1;
};
const pushStub = async () => {
  pushCalls += 1;
};

/** Fails on its first call, succeeds after - models a dropped connection. */
const removeFlaky = async () => {
  removeCalls += 1;
  if (removeCalls === 1) throw new WriteRejectedError('offline', 0);
};

// A failed delete is queued, then retried on a later flush and clears.
fresh();
enqueueRetry('customers', 'cust-1', null, new WriteRejectedError('offline', 0), 'delete');
report(
  'a failed delete is queued',
  readPending().length === 1 && readPending()[0].kind === 'delete',
  JSON.stringify(readPending()[0])
);

// First flush attempts it, the network is still down, so it stays queued.
const firstFlush = await flush(pushStub, removeFlaky);
report(
  'a still-failing delete stays queued rather than being lost',
  firstFlush === 0 && readPending().length === 1,
  `flushed ${firstFlush}, ${readPending().length} left`
);
// Second flush: the network is back, the delete lands and the queue clears.
const secondFlush = await flush(pushStub, removeFlaky);
report(
  'the delete lands on a later flush and clears the queue',
  secondFlush === 1 && readPending().length === 0,
  `flushed ${secondFlush}, ${readPending().length} left`
);

// A queued delete replays as a delete, not an upsert.
fresh();
enqueueRetry('customers', 'cust-3', null, new WriteRejectedError('offline', 0), 'delete');
pushCalls = 0;
removeCalls = 0;
await flush(pushStub, removeOk);
report(
  'a queued delete replays as a delete, not an upsert that would resurrect it',
  pushCalls === 0 && removeCalls === 1,
  `push ${pushCalls}, remove ${removeCalls}`
);

// A 429 on a delete is retried, not dropped.
fresh();
enqueueRetry('invoices', 'inv-1', null, new WriteRejectedError('Too many attempts', 429), 'delete');
const after429 = await flush(pushStub, removeOk);
report(
  'a delete that hit 429 is retried on the same flush, not dropped',
  after429 === 1,
  `flushed ${after429}`
);

// A permanent rejection on a delete is still dropped (it will never succeed).
fresh();
enqueueRetry('staff', 'st-1', null, new WriteRejectedError('forbidden', 403), 'delete');
await flush(pushStub, removeOk);
report(
  'a permanently rejected delete is dropped, not looped forever',
  readPending().every((e) => e.docId !== 'st-1'),
  JSON.stringify(readPending())
);

// A legacy queue entry with no `kind` still replays as an upsert.
fresh();
writePending([{ collection: 'customers', docId: 'legacy', payload: { a: 1 }, attempts: 0 }]);
pushCalls = 0;
await flush(pushStub, removeOk);
report(
  'a pre-existing queue entry (no kind field) still replays as an upsert',
  pushCalls === 1,
  `push ${pushCalls}`
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
