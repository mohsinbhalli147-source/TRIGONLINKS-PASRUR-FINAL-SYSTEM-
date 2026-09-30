/**
 * Exercises public/sw.js against a fake ServiceWorkerGlobalScope.
 *
 * The rewrite of the worker was prompted by the old one handing `undefined` to
 * `respondWith` when offline, which throws. This drives the real event handlers
 * and asserts the behaviours that matter:
 *
 *   - the shell is actually precached this time
 *   - an offline navigation resolves to the cached document, not undefined
 *   - /api/ and cross-origin requests are never intercepted
 *   - a non-GET is never intercepted
 *   - activate evicts the previous cache
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

/* -------------------------------------------------------------------------- */
/*  A minimal stand-in for the service worker globals                          */
/* -------------------------------------------------------------------------- */

/** A stand-in for a cached response. Only the fields the test inspects. */
interface FakeResponse {
  url: string;
  offlineDoc: true;
  type?: string;
  ok?: boolean;
  clone?: () => FakeResponse;
}

type Store = Map<string, FakeResponse>;
type RequestLike = string | { url: string };
type FetchEventHandler = (event: {
  request: RequestLike & { method: string; mode: string };
  respondWith: (p: Promise<unknown>) => void;
}) => void;
type LifecycleHandler = (event: { waitUntil: (p: Promise<unknown>) => void }) => void;
type Handler = FetchEventHandler & LifecycleHandler;

const precached: Store = new Map();
const stores: Map<string, Store> = new Map([['trigon-isp-suite-v1', precached]]);

const absolutise = (key: string): string => new URL(key, 'https://panel.test').href;

function makeCache(store: Store) {
  return {
    async add(url: string): Promise<void> {
      store.set(absolutise(url), { url, offlineDoc: true });
    },
    async put(request: RequestLike, response: FakeResponse): Promise<void> {
      store.set(absolutise(typeof request === 'string' ? request : request.url), response);
    },
  };
}

const caches = {
  async open(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    return makeCache(stores.get(name) as Store);
  },
  async keys(): Promise<string[]> {
    return [...stores.keys()];
  },
  async match(request: RequestLike): Promise<FakeResponse | undefined> {
    // A real Cache resolves relative keys against the worker's scope.
    const key = absolutise(typeof request === 'string' ? request : request.url);
    for (const store of stores.values()) {
      if (store.has(key)) return store.get(key);
    }
    return undefined;
  },
  async delete(name: string): Promise<boolean> {
    return stores.delete(name);
  },
};

let claimed = false;
const handlers: Record<string, Handler> = {};
const self = {
  location: new URL('https://panel.test/sw.js'),
  skipWaiting: async (): Promise<void> => {},
  clients: {
    claim: async (): Promise<void> => {
      claimed = true;
    },
  },
  addEventListener(type: string, handler: Handler): void {
    handlers[type] = handler;
  },
};

/** Swapped per test to simulate the network being up or down. */
type FetchImpl = (input: RequestLike) => Promise<unknown>;
let networkFetch: FetchImpl = () => Promise.resolve({ ok: true, type: 'basic' });

// The worker references bare `fetch`, `caches`, `self`, `URL`, `Response`, `Promise`.
const workerFetch = (input: RequestLike): Promise<unknown> => networkFetch(input);
new Function('self', 'caches', 'fetch', 'URL', 'Response', 'Promise', 'console', source)(
  self,
  caches,
  workerFetch,
  URL,
  Response,
  Promise,
  console
);

/* -------------------------------------------------------------------------- */

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

function driveFetch(request: { url: string; method: string; mode: string }) {
  let handled = false;
  let promise: Promise<unknown> | null = null;
  let threw: unknown = null;
  const event = {
    request,
    respondWith(p: Promise<unknown>) {
      handled = true;
      promise = p;
    },
  };
  try {
    (handlers.fetch as FetchEventHandler)(event);
  } catch (error) {
    threw = error;
  }
  return { handled, promise, threw };
}

const makeRequest = (
  url: string,
  { method = 'GET', mode = 'cors' }: { method?: string; mode?: string } = {}
) => ({ url, method, mode });

/** Runs a lifecycle handler and waits for the promise it hands to waitUntil. */
function runLifecycle(handler: Handler, name: string): Promise<unknown> {
  let pending: Promise<unknown> | null = null;
  (handler as LifecycleHandler)({
    waitUntil(p) {
      pending = p;
    },
  });
  if (!pending) throw new Error(`${name} did not call waitUntil`);
  return pending;
}

async function main() {
  // 1. install precaches a non-empty shell.
  await runLifecycle(handlers.install, 'install');
  report(
    'install precaches the app shell',
    precached.size > 0,
    `${precached.size}: ${[...precached.keys()].map((u) => new URL(u).pathname).join(' ')}`
  );

  // 2. Offline navigation resolves to the cached document, not undefined.
  networkFetch = () => Promise.reject(new Error('offline'));
  const nav = driveFetch(makeRequest('https://panel.test/dashboard', { mode: 'navigate' }));
  if (nav.threw) {
    report('offline navigation does not throw', false, String(nav.threw));
  } else if (!nav.handled || !nav.promise) {
    report('offline navigation is handled', false, 'respondWith not called');
  } else {
    let value: unknown = 'not-resolved';
    let rejected: unknown = null;
    try {
      value = await nav.promise;
    } catch (error) {
      rejected = error;
    }
    const cachedDoc =
      typeof value === 'object' && value !== null && (value as FakeResponse).offlineDoc === true;
    report(
      'offline navigation serves the cached document',
      rejected === null && cachedDoc,
      rejected
        ? `rejected: ${rejected}`
        : cachedDoc
          ? 'cached shell returned'
          : value === undefined
            ? 'resolved to undefined (this is the old bug)'
            : 'unexpected value'
    );
  }

  // 3. Bypass rules.
  const api = driveFetch(makeRequest('https://panel.test/api/auth/session'));
  report('/api/ requests bypass the worker', !api.handled);

  const external = driveFetch(makeRequest('https://sgp.cloud.appwrite.io/v1/databases/x/documents'));
  report('cross-origin requests bypass the worker', !external.handled);

  const post = driveFetch(makeRequest('https://panel.test/api/data/customers', { method: 'POST' }));
  report('non-GET requests bypass the worker', !post.handled);

  const getApi = driveFetch(makeRequest('https://panel.test/api/data/customers'));
  report('GET /api/ also bypasses the worker (no stale auth/data caching)', !getApi.handled);

  // 4. Cacheable asset is handled.
  const asset = driveFetch(makeRequest('https://panel.test/assets/index-abc.js'));
  report('same-origin build assets are handled', asset.handled);
  if (asset.promise) {
    // Resolve it so no dangling rejection surfaces.
    networkFetch = () =>
      Promise.resolve({
        ok: true,
        type: 'basic',
        clone: (): FakeResponse => ({ url: '', offlineDoc: true }),
      });
    const pending: Promise<unknown> = asset.promise;
    await pending.catch(() => undefined);
  }

  // 5. activate evicts stale caches.
  stores.set('trigon-links-v1', new Map([['/stale', { url: '/stale', offlineDoc: true }]]));
  await runLifecycle(handlers.activate, 'activate');
  report(
    'activate drops the previous cache',
    !stores.has('trigon-links-v1') && stores.has('trigon-isp-suite-v1'),
    `remaining: ${[...stores.keys()].join(', ')}`
  );
  report('activate claims open clients', claimed);

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
