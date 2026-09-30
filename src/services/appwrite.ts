import type { AppwriteConnection } from './authApi';

/**
 * Reading operational data for the staff panel.
 *
 * The browser used to talk to Appwrite directly, holding a JWT issued at login.
 * That silently returned nothing: a JWT names the account, not the teams it
 * belongs to, so the `read("team:area_...")` grant on every row never matched and
 * every area-scoped collection came back empty. Reads now go through the server,
 * which has the API key and resolves the area the same way the write path does.
 *
 * The consequence is that the browser holds no Appwrite credential at all. There
 * is no create, update or delete method on this service, and there is no session
 * token to escalate, because none is issued. Writes went to the server before
 * this change for the same reason - see src/services/writeApi.ts - and the two
 * paths now agree on one rule: the server decides what a session may see.
 *
 * Subscribers do not use this module at all: they read their own data from the
 * server's /api/portal endpoint, which is scoped to their session.
 */

export const COLLECTIONS = {
  customers: 'customers',
  packages: 'packages',
  connections: 'connections',
  invoices: 'invoices',
  payments: 'payments',
  staff: 'staff',
  inventory: 'inventory',
  expenses: 'expenses',
  areas: 'areas',
  complaints: 'complaints',
  activityLogs: 'activity_logs',
  deletionRequests: 'deletion_requests',
  announcements: 'announcements',
  messages: 'messages',
  settings: 'settings',
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

/** Fields that must never be mirrored into the browser's local cache. */
const CREDENTIAL_FIELDS = ['password', 'passwordHash', 'pppoePassword', 'secret'] as const;

type AppRecord = Record<string, unknown> & { id: string };

/**
 * Returns a copy with credential fields removed. Applied before anything is
 * written to localStorage, so the browser cache can never hold a password or a
 * PPPoE secret.
 */
export function redactRecord<T>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const copy: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  for (const field of CREDENTIAL_FIELDS) delete copy[field];
  return copy as T;
}

class AppwriteServiceClass {
  private connection: AppwriteConnection | null = null;
  private ready = false;

  public get collections(): typeof COLLECTIONS {
    return COLLECTIONS;
  }

  public getIsConfigured(): boolean {
    return this.ready;
  }

  public getConnection(): AppwriteConnection | null {
    return this.connection;
  }

  /**
   * Records the connection details. There is no credential to attach: the
   * httpOnly session cookie is the only thing that authorises a read, and the
   * browser never sees a token.
   */
  public init(connection: AppwriteConnection): void {
    this.connection = connection;
    this.ready = true;
  }

  public clearSession(): void {
    this.ready = false;
    this.connection = null;
  }

  /**
   * Reads a collection, through the server.
   */
  public async listDocs(collectionKey: CollectionKey): Promise<AppRecord[]> {
    const response = await fetch(`/api/data/${collectionKey}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // The session is gone or has lost its access. Surface it rather than
        // leaving the panel showing a permanently empty table.
        window.dispatchEvent(new CustomEvent('trigon_session_expired'));
        return [];
      }
      throw new Error(`Could not load ${collectionKey} (${response.status}).`);
    }

    const body = (await response.json()) as { documents?: AppRecord[] };
    return Array.isArray(body.documents) ? body.documents : [];
  }

  /**
   * The most recent rows of a collection, newest first.
   *
   * The activity log grows without bound - every save appends a row - so pulling
   * all of it every cycle would download hundreds of rows twenty times a minute
   * to show an operator something they will never scroll back to. The server
   * already returns newest-first, so the cap is applied here.
   */
  public async listRecentDocs(
    collectionKey: CollectionKey,
    limit: number
  ): Promise<AppRecord[]> {
    const all = await this.listDocs(collectionKey);
    return all.slice(0, limit);
  }
}

export const AppwriteService = new AppwriteServiceClass();
export type { AppRecord };
