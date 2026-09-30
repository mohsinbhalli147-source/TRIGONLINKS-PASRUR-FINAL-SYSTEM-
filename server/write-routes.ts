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
import { AuthError, rateLimit, type AuthProfile, type SessionClaims } from './auth';
import {
  COLLECTIONS,
  deleteDocument as appwriteDelete,
  permissionsForArea,
  upsertDocument,
  type CollectionKey,
} from './appwrite-rest';
import {
  authorizeWrite,
  invalidateAreaCaches,
  isWritableCollection,
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

function asObject(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AuthError('A record body must be an object.', 400);
  }
  return value as Record<string, unknown>;
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

  // A write changes the customer -> area mapping other writes are judged against.
  if (decision.collection === 'customers') invalidateAreaCaches();

  return {
    ok: true,
    created: decision.isNew,
    document: { id: document.id, updatedAt: document.updatedAt },
  };
}

export function registerWriteRoutes(app: import('express').Express, deps: WriteRouteDeps): void {
  /**
   * Bulk push, registered before the `:collection` route so the literal path is
   * not swallowed by the parameterised one.
   */
  app.post(
    '/api/data/bulk',
    deps.asyncRoute(async (req, res) => {
      deps.assertSameOrigin(req);
      const claims = deps.requireSession(req);
      const profile = await deps.resolveProfile(claims);

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
      const profile = await deps.resolveProfile(claims);

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
      const profile = await deps.resolveProfile(claims);

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
}
