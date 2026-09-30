/**
 * The browser's only way to change data.
 *
 * Writes used to go straight to Appwrite with the signed-in staff member's own
 * session token. That meant Appwrite evaluated every write against the browser
 * rather than against the server, so the server's role and area checks were never
 * consulted - a staff member's devtools could create, update or delete records in
 * collections and areas their role had no access to.
 *
 * Reads are deliberately still direct. Appwrite is good at it, it keeps the panel
 * fast, and the row-level read permissions are already correct. Only writes come
 * through the server now.
 */
import type { CollectionKey } from './appwrite';

export class WriteRejectedError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WriteRejectedError';
    this.status = status;
  }
}

/**
 * A rejection that will never succeed on retry: the server is not going to
 * change its mind about permissions. The pending-write queue uses this to drop a
 * record instead of retrying it five times and stalling everything behind it.
 *
 * 429 is deliberately excluded. It means "too many requests right now", not
 * "this will never work", and it used to be treated as permanent because it is
 * under 500 - so a write that hit a rate limit was dropped from the retry queue
 * and silently lost. The server also sends 429 for its own sign-in limiter, and
 * 425 for a not-yet-ready backend, both of which clear on their own.
 *
 * Retryable on top of those: 408 (request timeout) and 425 (too early).
 * Genuinely permanent: 400, 401, 403, 404, 409 and 422 - the payload, the
 * session or the record is wrong, and repeating the same call changes nothing.
 */
export function isPermanentRejection(error: unknown): boolean {
  if (!(error instanceof WriteRejectedError)) return false;
  // status 0 is a network failure, and 5xx is a server fault. Both clear up.
  if (error.status === 0 || error.status >= 500) return false;
  return !RETRYABLE_STATUSES.has(error.status);
}

/** Statuses that mean "wait and try again", not "this is wrong". */
const RETRYABLE_STATUSES = new Set([408, 425, 429]);

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) return body.message;
  } catch {
    /* keep the fallback */
  }
  return fallback;
}

async function send(
  path: string,
  init: { method: string; body?: unknown }
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method,
      headers: { 'Content-Type': 'application/json' },
      // The session cookie is the credential. Same-origin, so it is sent.
      credentials: 'same-origin',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    // Network problem. Not permanent - the pending queue will retry.
    throw new WriteRejectedError('Cannot reach the server. Check your connection.', 0);
  }

  if (!response.ok) {
    throw new WriteRejectedError(
      await readError(response, 'The change was rejected.'),
      response.status
    );
  }
}

/**
 * Creates or updates one record. The server decides which of the two it is by
 * looking at what is already stored, so there is no ambiguity to get wrong here.
 */
export async function pushDocument(
  collection: CollectionKey,
  docId: string,
  data: unknown
): Promise<void> {
  await send(`/api/data/${collection}`, {
    method: 'POST',
    body: { id: docId, data },
  });
}

export async function removeDocument(
  collection: CollectionKey,
  docId: string
): Promise<void> {
  await send(`/api/data/${collection}/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });
}

/**
 * The explicit "push everything to the server" action. Records the caller's role
 * or area does not cover are reported back rather than silently skipped, because
 * this is a repair action somebody ran on purpose and needs to see what was
 * refused.
 */
export async function pushBulk(
  dataset: Record<string, Array<{ id: string }>>
): Promise<{ success: boolean; message: string; count: number }> {
  const records: Array<{ collection: string; id: string; data: unknown }> = [];

  for (const [collection, items] of Object.entries(dataset)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item?.id) continue;
      records.push({ collection, id: String(item.id), data: item });
    }
  }

  if (records.length === 0) {
    return { success: true, message: 'Nothing to push.', count: 0 };
  }

  let response: Response;
  try {
    response = await fetch('/api/data/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ records }),
    });
  } catch {
    throw new WriteRejectedError('Cannot reach the server. Check your connection.', 0);
  }

  if (!response.ok) {
    throw new WriteRejectedError(
      await readError(response, 'The push was rejected.'),
      response.status
    );
  }

  const body = (await response.json()) as {
    ok: boolean;
    written: number;
    message: string;
  };
  return { success: body.ok, message: body.message, count: body.written };
}
