/**
 * The application's only write path.
 *
 *   Browser  ->  POST /api/data/:collection     (upsert)
 *   Browser  ->  DELETE /api/data/:collection/:id
 *   Browser  ->  POST /api/data/bulk            (the explicit "push everything" action)
 *
 * Every one of them ends in the same three steps: verify the session, decide with
 * the write policy, then write with the server API key. The browser never sends
 * permissions - they are computed here from the record's resolved area, so a
 * client cannot grant itself access to a row by naming a different area.
 */
import type { NextFunction, Request, Response } from 'express';
import { AuthError, invalidateIdentityCaches, rateLimit, type AuthProfile, type SessionClaims } from './auth';
import {
  COLLECTIONS,
  deleteDocument as appwriteDelete,
  getDocument,
  listDocuments,
  permissionsForArea,
  upsertDocument,
  type CollectionKey,
} from './appwrite-rest';
import {
  credentialCollectionId,
  hashCnic,
  isPlausibleCnic,
  normaliseCnic,
} from './subscriber-credentials';
import {
  authorizeWrite,
  filterReadableRows,
  invalidateAreaCaches,
  isWritableCollection,
  WRITE_POLICY,
  type AuthorizedWrite,
} from './write-authz';

export interface WriteRouteDeps {
  /** Reads and verifies the signed-in staff session. */
  requireSession: (req: Request) => SessionClaims;
  /** Re-reads the staff record so role and area grants are current. */
  resolveProfile: (claims: SessionClaims) => Promise<AuthProfile>;
  /** Cross-origin guard, already implemented in server.ts. */
  assertSameOrigin: (req: Request) => void;
  /** The express async wrapper, so thrown AuthErrors reach the error handler. */
  asyncRoute: (
    handler: (req: Request, res: Response) => Promise<void>
  ) => (req: Request, res: Response, next: NextFunction) => void;
}

/** Appwrite document ids are 36 chars; ours are generated ids like `cust-...`. */
function assertUsableDocumentId(value: string): string {
  const id = String(value ?? '').trim();
  if (!id || id.length > 128) {
    throw new AuthError('A record id is required.', 400);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new AuthError('That record id is not valid.', 400);
  }
  return id;
}

function assertUsableCollection(value: string): CollectionKey {
  const name = String(value ?? '').trim();
  if (!isWritableCollection(name)) {
    throw new AuthError('Unknown collection.', 404);
  }
  return name;
}

/**
 * Reads accept every collection the panel syncs, not only the writable ones.
 * Activity logs, deletion requests and settings have no write policy because the
 * server writes them itself, but staff still have to be able to read them.
 */
function assertReadableCollection(value: string): CollectionKey {
  const name = String(value ?? '').trim();
  if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, name)) {
    throw new AuthError('Unknown collection.', 404);
  }
  return name as CollectionKey;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AuthError('A record body must be an object.', 400);
  }
  return value as Record<string, unknown>;
}

/**
 * Keeps the subscriber sign-in credential in step with the customer record.
 *
 * Subscriber sign-in is user ID plus CNIC, checked against a PBKDF2 hash in the
 * server-only credential collection. That hash used to be written only by
 * `npm run provision`, so an operator who added a connection in the panel
 * produced a subscriber who could not sign in until somebody remembered to run a
 * provisioning script. Re-hashing on write closes that gap, and it re-hashes only
 * when the CNIC on the record has actually changed, so a routine edit does not
 * invalidate a working password.
 *
 * Failures are logged and swallowed: this must never fail the customer write
 * that triggered it. A customer with no usable CNIC is left for provision to
 * report, exactly as before.
 */
async function syncSubscriberCredential(customer: Record<string, unknown>): Promise<void> {
  try {
    const id = String(customer.id ?? '');
    if (!id) return;

    const cnic = normaliseCnic(customer.cnic);
    if (!isPlausibleCnic(cnic)) return;

    const existing = (await getDocument<Record<string, unknown>>(
      credentialCollectionId,
      id
    )) as { cnicDigits?: string } | null;

    if (existing && existing.cnicDigits === cnic) return;

    const hashed = hashCnic(cnic);
    await upsertDocument(credentialCollectionId, id, {
      id,
      customerId: id,
      cnicDigits: cnic,
      hash: hashed.hash,
      salt: hashed.salt,
      iterations: hashed.iterations,
      userIdLabel: (customer.username as string | undefined) ?? null,
    });
  } catch (error) {
    console.warn('[write] could not refresh the subscriber credential:', error);
  }
}

async function perform(deps: WriteRouteDeps, decision: AuthorizedWrite): Promise<Record<string, unknown>> {
  if (decision.operation === 'delete') {
    await appwriteDelete(COLLECTIONS[decision.collection], decision.documentId);
    invalidateAreaCaches();
    return { ok: true, deleted: decision.documentId };
  }

  /**
   * The permission list is computed here, from the area the server resolved, and
   * is the only one sent to Appwrite. It is read-only: the browser has no write
   * path, so it must not be able to hold an update or delete grant even on a row
   * it created. Shared with the provisioning script so there is exactly one
   * definition of what a row grants.
   */
  const document = await upsertDocument<Record<string, unknown>>(
    COLLECTIONS[decision.collection],
    decision.documentId,
    decision.payload,
    permissionsForArea(decision.areaId, COLLECTIONS[decision.collection])
  );

  // A write changes the customer -> area mapping other writes are judged against,
  // and the sign-in index that maps a user ID to a subscriber. Both were cached
  // with a five minute lifetime and nothing invalidated them, so a subscriber
  // created or renamed by an operator could not sign in until the cache happened
  // to expire.
  if (decision.collection === 'customers') {
    invalidateAreaCaches();
    invalidateIdentityCaches();
    await syncSubscriberCredential(decision.payload);
  }

  return {
    ok: true,
    created: decision.isNew,
    document: { id: document.id, updatedAt: document.updatedAt },
  };
}

export function registerWriteRoutes(app: import('express').Express, deps: WriteRouteDeps): void {
  /**
   * Resolves the staff profile for a write.
   *
   * A subscriber session is refused here, before any profile lookup. They have
   * no staff record and their session carries a synthetic id, so trying to load a
   * staff profile for them asks Appwrite for a user id that does not exist and
   * comes back as a 500 from a request that should have been a plain 403. The
   * write policy refuses subscribers too - this just makes the refusal clean and
   * keeps a routine permission check out of the error log.
   */
  const resolveStaffForWrite = async (claims: SessionClaims): Promise<AuthProfile> => {
    if (claims.role === 'Customer') {
      throw new AuthError('Your account cannot change operational records.', 403);
    }
    return deps.resolveProfile(claims);
  };

  /**
   * Bulk push, registered before the `:collection` route so the literal path is
   * not swallowed by the parameterised one.
   */
  app.post(
    '/api/data/bulk',
    deps.asyncRoute(async (req, res) => {
      deps.assertSameOrigin(req);
      const claims = deps.requireSession(req);
      const profile = await resolveStaffForWrite(claims);

      const limit = rateLimit(`bulk:${claims.uid}`, 30, 60_000);
      if (!limit.allowed) throw new AuthError('Too many sync attempts. Try again shortly.', 429);

      const body = asObject(req.body);
      const records = Array.isArray(body.records) ? body.records : null;
      if (!records) throw new AuthError('records must be an array.', 400);
      if (records.length > 500) throw new AuthError('Too many records in one push.', 400);

      const written: string[] = [];
      const rejected: Array<{ id: string; reason: string }> = [];

      /**
       * One bad record must not abandon the rest: this is a bulk repair action an
       * administrator runs on purpose, and a single out-of-scope row failing is
       * the correct outcome for that row, not for the whole push.
       */
      for (const entry of records) {
        const item = asObject(entry);
        const collection = assertUsableCollection(String(item.collection ?? ''));
        const documentId = assertUsableDocumentId(String(item.id ?? ''));

        try {
          const decision = await authorizeWrite({
            claims,
            profile,
            collection,
            documentId,
            operation: 'upsert',
            incoming: asObject(item.data),
          });
          await perform(deps, decision);
          written.push(`${collection}/${documentId}`);
        } catch (error) {
          rejected.push({
            id: `${collection}/${documentId}`,
            reason: error instanceof Error ? error.message : 'Rejected.',
          });
        }
      }

      res.json({
        ok: rejected.length === 0,
        written: written.length,
        rejected,
        message:
          rejected.length === 0
            ? `Pushed ${written.length} record(s).`
            : `Pushed ${written.length} record(s); ${rejected.length} were rejected.`,
      });
    })
  );

  app.post(
    '/api/data/:collection',
    deps.asyncRoute(async (req, res) => {
      deps.assertSameOrigin(req);
      const claims = deps.requireSession(req);
      const profile = await resolveStaffForWrite(claims);

      const limit = rateLimit(`write:${claims.uid}`, 600, 60_000);
      if (!limit.allowed) throw new AuthError('Too many changes. Try again shortly.', 429);

      const collection = assertUsableCollection(req.params.collection);
      const body = asObject(req.body);
      const incoming = asObject(body.data ?? body);

      const documentId = assertUsableDocumentId(
        String(body.id ?? incoming.id ?? '')
      );

      const decision = await authorizeWrite({
        claims,
        profile,
        collection,
        documentId,
        // The server decides create vs update from what is stored.
        operation: 'upsert',
        incoming,
      });

      const result = await perform(deps, decision);
      res.status(decision.isNew ? 201 : 200).json(result);
    })
  );

  app.delete(
    '/api/data/:collection/:documentId',
    deps.asyncRoute(async (req, res) => {
      deps.assertSameOrigin(req);
      const claims = deps.requireSession(req);
      const profile = await resolveStaffForWrite(claims);

      const collection = assertUsableCollection(req.params.collection);
      const documentId = assertUsableDocumentId(req.params.documentId);

      const decision = await authorizeWrite({
        claims,
        profile,
        collection,
        documentId,
        operation: 'delete',
        incoming: null,
      });

      const result = await perform(deps, decision);
      res.json(result);
    })
  );

  /**
   * Reads a collection, narrowed to what this session may see.
   *
   * The browser used to ask Appwrite directly with a JWT, which returned nothing
   * for area-scoped collections: a JWT names the account, not the teams it is in,
   * so the row permission lists never matched. The server has the API key and
   * resolves the area the same way the write path does, so a row is readable
   * exactly when it is writable.
   */
  app.get(
    '/api/data/:collection',
    deps.asyncRoute(async (req, res) => {
      const claims = deps.requireSession(req);
      const profile = await resolveStaffForWrite(claims);

      const collection = assertReadableCollection(req.params.collection);

      const limit = rateLimit(`read:${claims.uid}`, 900, 60_000);
      if (!limit.allowed) throw new AuthError('Too many refreshes. Try again shortly.', 429);

      const rows = await listDocuments<Record<string, unknown>>(COLLECTIONS[collection], {
        limit: 5000,
      });
      const visible = await filterReadableRows(collection, rows, profile);

      // Newest first, so a record that has just been filed is at the top rather
      // than wherever it happens to sort in the stored order.
      visible.sort((a, b) =>
        String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
      );

      res.json({ ok: true, collection, documents: visible });
    })
  );
}
