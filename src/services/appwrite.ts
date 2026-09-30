import { Client, Databases, Query } from 'appwrite';
import type { AppwriteConnection } from './authApi';

/**
 * READ-ONLY Appwrite access for the staff panel.
 *
 * The browser talks to Appwrite directly, using the session token issued at
 * login, to read operational data. That is the whole of its access: there is no
 * create, update or delete method on this service, and none can be added without
 * the same authorization gap reopening.
 *
 * Writes go to the server instead - see src/services/writeApi.ts. The server
 * checks the caller's role, section, function grant and area against the record
 * as it is actually stored, then writes with the API key. The browser never
 * sends a permission list, because the browser is not the thing that should
 * decide who may see a row.
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

const PAGE_LIMIT = 5000;

/** Fields that must never be mirrored into the browser's local cache. */
const CREDENTIAL_FIELDS = ['password', 'passwordHash', 'pppoePassword', 'secret'] as const;

interface SchemalessDocument {
  $id: string;
  data?: string;
  recordId?: string;
  $createdAt: string;
  $updatedAt: string;
}

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
  private client: Client | null = null;
  private databases: Databases | null = null;
  private connection: AppwriteConnection | null = null;
  private ready = false;

  public get collections(): typeof COLLECTIONS {
    return COLLECTIONS;
  }

  public getIsConfigured(): boolean {
    return this.ready && this.databases !== null;
  }

  public getConnection(): AppwriteConnection | null {
    return this.connection;
  }

  /** Idempotent. Safe to call again after a session change. */
  public init(connection: AppwriteConnection, token: string): void {
    this.connection = connection;
    this.client = new Client()
      .setEndpoint(connection.endpoint)
      .setProject(connection.projectId)
      .setJWT(token);
    this.databases = new Databases(this.client);
    this.ready = true;
  }

  public setSession(token: string): void {
    this.client?.setJWT(token);
  }

  public clearSession(): void {
    this.client?.setJWT('');
    this.ready = false;
    this.databases = null;
    this.client = null;
  }

  private requireDatabases(): Databases {
    if (!this.databases) {
      throw new Error('Appwrite is not connected. Sign in to continue.');
    }
    return this.databases;
  }

  private static decode(doc: SchemalessDocument): AppRecord {
    let parsed: Record<string, unknown> = {};
    if (typeof doc.data === 'string') {
      try {
        parsed = JSON.parse(doc.data) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }
    return { ...parsed, id: doc.$id };
  }

  private collectionId(key: CollectionKey): string {
    return COLLECTIONS[key];
  }

  /**
   * Reads a collection.
   *
   * Row-level read permissions decide what comes back, so this needs no
   * filtering of its own: a technician only receives documents whose area team
   * they belong to.
   */
  public async listDocs(collectionKey: CollectionKey): Promise<AppRecord[]> {
    const databases = this.requireDatabases();
    const response = await databases.listDocuments(
      this.connection!.databaseId,
      this.collectionId(collectionKey),
      [Query.limit(PAGE_LIMIT)]
    );
    return response.documents.map((doc) => AppwriteServiceClass.decode(doc as SchemalessDocument));
  }

  /**
   * The most recent rows of a collection, newest first.
   *
   * The activity log grows without bound - every save appends a row - so pulling
   * all of it every cycle would download hundreds of rows twenty times a minute
   * to show an operator something they will never scroll back to. Ordering by
   * creation time and capping the page keeps that cost flat.
   */
  public async listRecentDocs(
    collectionKey: CollectionKey,
    limit: number
  ): Promise<AppRecord[]> {
    const databases = this.requireDatabases();
    const response = await databases.listDocuments(
      this.connection!.databaseId,
      this.collectionId(collectionKey),
      [Query.orderDesc('$createdAt'), Query.limit(limit)]
    );
    return response.documents.map((doc) => AppwriteServiceClass.decode(doc as SchemalessDocument));
  }
}

export const AppwriteService = new AppwriteServiceClass();
export type { AppRecord };
