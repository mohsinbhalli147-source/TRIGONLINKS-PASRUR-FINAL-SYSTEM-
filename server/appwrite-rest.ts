import config from './config';

export interface AppwriteErrorBody {
  message?: string;
  code?: number;
}

export class AppwriteRestError extends Error {
  public readonly status: number;
  public readonly code?: number;

  constructor(status: number, body: AppwriteErrorBody, fallback: string) {
    super(body.message || fallback);
    this.name = 'AppwriteRestError';
    this.status = status;
    this.code = body.code;
  }
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  /** Server API key. Omit for public endpoints such as account session creation. */
  authenticated?: boolean;
  signal?: AbortSignal;
  /** Transport-level retries. Defaults to 4. */
  attempts?: number;
  /**
   * Extra request headers. Used to replay the Appwrite session cookie when
   * minting a JWT; never for the API key, which `appwriteRequest` sets itself.
   */
  headers?: Record<string, string>;
}

/**
 * Minimal Appwrite REST client. Only the server uses this: the browser talks to
 * Appwrite directly with the per-user session token it receives at login.
 *
 * Network failures are retried with backoff. Provisioning makes a few hundred
 * sequential calls, so on a flaky link a single dropped request would otherwise
 * abort a run that had already half-applied.
 */
export async function appwriteRequest<T>({
  method,
  path: apiPath,
  query,
  body,
  authenticated = true,
  signal,
  attempts = 4,
  headers: extraHeaders,
}: RequestOptions): Promise<T> {
  const { data } = await appwriteRequestWithHeaders<T>({
    method,
    path: apiPath,
    query,
    body,
    authenticated,
    signal,
    attempts,
    headers: extraHeaders,
  });
  return data;
}

/**
 * The same request, but also hands back the response headers.
 *
 * Appwrite 2.x returns a session as a cookie rather than in the body, so
 * creating a session needs to read `set-cookie` before it can ask for a JWT.
 */
async function appwriteRequestWithHeaders<T>({
  method,
  path: apiPath,
  query,
  body,
  authenticated = true,
  signal,
  attempts = 4,
  headers: extraHeaders,
}: RequestOptions): Promise<{ data: T; headers: Headers }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await appwriteRequestOnce<T>({
        method,
        path: apiPath,
        query,
        body,
        authenticated,
        signal,
        headers: extraHeaders,
      });
    } catch (error) {
      lastError = error;
      // Only transport-level problems are worth retrying; an Appwrite 4xx is a
      // decision, not a hiccup.
      const isTransport =
        !(error instanceof AppwriteRestError) &&
        (error instanceof TypeError ||
          /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(
            (error as Error)?.message ?? ''
          ));
      if (!isTransport || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }
  }

  throw lastError;
}

async function appwriteRequestOnce<T>({
  method,
  path: apiPath,
  query,
  body,
  authenticated = true,
  signal,
  headers: extraHeaders,
}: Omit<RequestOptions, 'attempts'>): Promise<{ data: T; headers: Headers }> {
  const url = new URL(`${config.appwrite.endpoint}${apiPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      const values = Array.isArray(value) ? value : [value];
      for (const entry of values) url.searchParams.append(key, entry);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': config.appwrite.projectId,
    ...extraHeaders,
  };
  if (authenticated) headers['X-Appwrite-Key'] = config.appwrite.apiKey;

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const text = response.status === 204 ? '' : await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errBody = (parsed ?? {}) as AppwriteErrorBody;
    throw new AppwriteRestError(
      response.status,
      errBody,
      `Appwrite responded ${response.status} for ${method} ${apiPath}`
    );
  }

  return { data: (parsed ?? {}) as T, headers: response.headers };
}

const db = () => config.appwrite.databaseId;
const pathBase = () => `/databases/${db()}`;

/* -------------------------------------------------------------------------- */
/*  Documents (schemaless: every record is a JSON string in the `data` column) */
/* -------------------------------------------------------------------------- */

/** A record as the application models it, with identity fields filled in. */
export type AppRecord<T> = T & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

interface RawDocument {
  $id: string;
  $collectionId: string;
  /**
   * The schemaless payload column. Appwrite returns the row's data as an object
   * keyed by column name, so the column literally called `data` arrives as the
   * JSON string in `doc.data` itself - not nested under `doc.data.data`.
   */
  data?: string | { data?: string };
  $createdAt: string;
  $updatedAt: string;
}

function rawPayload(doc: RawDocument): string | null {
  if (typeof doc.data === 'string') return doc.data;
  if (doc.data && typeof doc.data === 'object' && typeof doc.data.data === 'string') {
    return doc.data.data;
  }
  return null;
}

function decode<T>(doc: RawDocument): AppRecord<T> {
  let parsed: Record<string, unknown> = {};
  const payload = rawPayload(doc);
  if (payload) {
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      // A malformed payload must not take down the whole listing.
      parsed = {};
    }
  }
  return {
    ...parsed,
    id: doc.$id,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  } as AppRecord<T>;
}

export async function listDocuments<T>(
  collectionId: string,
  options: { limit?: number; offset?: number } = {},
  signal?: AbortSignal
): Promise<AppRecord<T>[]> {
  const result = await appwriteRequest<{ documents: RawDocument[] }>({
    method: 'GET',
    path: `${pathBase()}/collections/${collectionId}/documents`,
    query: {
      'queries[]': JSON.stringify({
        method: 'limit',
        values: [options.limit ?? 5000],
      }),
    },
    signal,
  });
  return (result.documents ?? []).map((doc) => decode<T>(doc));
}

export async function getDocument<T>(
  collectionId: string,
  documentId: string
): Promise<AppRecord<T> | null> {
  try {
    const doc = await appwriteRequest<RawDocument>({
      method: 'GET',
      path: `${pathBase()}/collections/${collectionId}/documents/${documentId}`,
    });
    return decode<T>(doc);
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 404) return null;
    throw error;
  }
}

export async function setDocumentPermissions(
  collectionId: string,
  documentId: string,
  payload: unknown,
  permissions: string[]
): Promise<AppRecord<unknown>> {
  /**
   * Appwrite exposes no PUT .../permissions sub-resource; permissions are set by
   * passing them alongside the row data on a document update. That means the
   * payload must be sent again unchanged, or the record would be blanked.
   */
  return upsertDocument(collectionId, documentId, payload, permissions);
}

export async function upsertDocument<T>(
  collectionId: string,
  documentId: string,
  payload: T,
  permissions?: string[]
): Promise<AppRecord<T>> {
  const body: Record<string, unknown> = {
    data: { data: JSON.stringify(payload) },
  };
  if (permissions) body.permissions = permissions;

  const documentPath = `${pathBase()}/collections/${collectionId}/documents/${documentId}`;

  try {
    const doc = await appwriteRequest<RawDocument>({ method: 'PATCH', path: documentPath, body });
    return decode<T>(doc);
  } catch (error) {
    if (!(error instanceof AppwriteRestError) || error.status !== 404) throw error;
    const created = await appwriteRequest<RawDocument>({
      method: 'POST',
      path: `${pathBase()}/collections/${collectionId}/documents`,
      body: { documentId, ...body },
    });
    return decode<T>(created);
  }
}

export async function deleteDocument(
  collectionId: string,
  documentId: string
): Promise<void> {
  await appwriteRequest({
    method: 'DELETE',
    path: `${pathBase()}/collections/${collectionId}/documents/${documentId}`,
  });
}

/* -------------------------------------------------------------------------- */
/*  Identity: Appwrite accounts own the passwords                             */
/* -------------------------------------------------------------------------- */

export interface AppwriteUser {
  $id: string;
  email: string;
  name: string;
  /**
   * Appwrite 2.x returns a boolean here (`true` for an active account). Older
   * projects returned the string 'active' | 'disabled' | 'unverified', so both
   * shapes are accepted and read through `isAppwriteUserActive`.
   */
  status: boolean | 'active' | 'disabled' | 'unverified';
  labels: string[];
  passwordUpdate?: string;
}

/** True for an account Appwrite will let sign in, on either status shape. */
export function isAppwriteUserActive(user: { status: AppwriteUser['status'] }): boolean {
  if (typeof user.status === 'boolean') return user.status;
  return user.status === 'active';
}

export interface AppwriteSession {
  $id: string;
  /** The 15 minute JWT the browser presents to Appwrite. */
  token: string;
  /** Always empty: Appwrite 2.x has no separate session secret. */
  secret: string;
  /** When `token` stops being accepted. */
  expireAt: string;
  /** When the underlying session itself ends, independent of the JWT. */
  sessionExpiresAt: string;
  /**
   * The `a_session_<project>` cookie value.
   *
   * This is the long lived credential, so it stays on the server. Holding it is
   * what lets a fresh 15 minute JWT be minted without the user's password, and
   * it is why the browser never needs a non-expiring token.
   */
  sessionCookie: string;
}

/** Appwrite names the session cookie `a_session_<projectId>`. */
const sessionCookieName = (): string => `a_session_${config.appwrite.projectId}`;

interface AppwriteSessionModel {
  $id: string;
  expire: string;
}

/**
 * Signs a user in on Appwrite 2.x.
 *
 * The old `POST /account/sessions/token` with an email and password is gone; on
 * 2.x that route only accepts `userId` + `secret` for the magic URL and OTP
 * flows, and rejects an email with:
 *
 *     Param "userId" is not optional.
 *
 * The supported password flow is two steps: `sessions/email` verifies the
 * password and answers with a session cookie, then `account/jwt` exchanges that
 * cookie for a 15 minute JWT. Both steps are needed - the first is what proves
 * the password, the second is what the browser can actually use.
 */
export async function createUserSession(
  email: string,
  password: string
): Promise<AppwriteSession> {
  const created = await appwriteRequestWithHeaders<AppwriteSessionModel>({
    method: 'POST',
    path: '/account/sessions/email',
    body: { email, password },
    authenticated: false,
  });

  const name = sessionCookieName();
  const cookie = created.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0]?.trim() ?? '')
    .find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) {
    throw new AppwriteRestError(
      500,
      { message: `Appwrite returned no ${name} cookie for the new session` },
      'Appwrite accepted the sign-in but issued no session cookie'
    );
  }

  const { jwt, expireAt } = await mintSessionJwt(cookie);

  return {
    $id: created.data.$id,
    token: jwt,
    secret: '',
    expireAt,
    sessionExpiresAt: created.data.expire,
    sessionCookie: cookie,
  };
}

/**
 * Exchanges a session cookie for a fresh 15 minute JWT.
 *
 * Cheap by design: it verifies nothing that the session has not already proved,
 * which is what makes it safe to call on a timer, and it is why a browser that
 * has been open for hours does not need the password again.
 */
export async function mintSessionJwt(
  sessionCookie: string
): Promise<{ jwt: string; expireAt: string }> {
  return appwriteRequest<{ jwt: string; expireAt: string }>({
    method: 'POST',
    path: '/account/jwt',
    authenticated: false,
    headers: { Cookie: sessionCookie, 'X-Appwrite-Session': sessionCookie.slice(sessionCookie.indexOf('=') + 1) },
  });
}

/** Finds an account by email without ever exposing the API key to a caller. */
export async function findUserByEmail(email: string): Promise<AppwriteUser | null> {
  const result = await appwriteRequest<{ users: AppwriteUser[] }>({
    method: 'GET',
    path: '/users',
    query: {
      'queries[]': [
        JSON.stringify({ method: 'equal', attribute: 'email', values: [email] }),
        JSON.stringify({ method: 'limit', values: [1] }),
      ],
    },
  });
  return result.users?.[0] ?? null;
}

export async function getUser(userId: string): Promise<AppwriteUser> {
  return appwriteRequest<AppwriteUser>({ method: 'GET', path: `/users/${userId}` });
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  labels: string[];
}): Promise<AppwriteUser> {
  return appwriteRequest<AppwriteUser>({
    method: 'POST',
    path: '/users',
    body: {
      userId: 'unique()',
      email: input.email,
      // The browser never receives this. It is only ever sent back to Appwrite.
      password: input.password,
      name: input.name,
      labels: input.labels,
    },
  });
}

export async function updateUserPassword(userId: string, password: string): Promise<void> {
  await appwriteRequest({
    method: 'PUT',
    path: `/users/${userId}/password`,
    body: { password },
  });
}

export async function setUserLabels(userId: string, labels: string[]): Promise<void> {
  await appwriteRequest({
    method: 'PUT',
    path: `/users/${userId}/labels`,
    body: { labels },
  });
}

/**
 * Revokes a session upstream, so a token the browser still holds stops working
 * the moment the user signs out.
 *
 * This goes through the user-scoped route rather than
 * `DELETE /account/sessions/{id}`: the account routes act on the caller's *own*
 * session, and the API key is not signed in, so Appwrite rejects it with
 *
 *     (role: applications) missing scopes (["account"])
 *
 * `users` is within the API key's scopes, so this is the route that works.
 */
export async function deleteUserSession(userId: string, sessionId: string): Promise<void> {
  await appwriteRequest({
    method: 'DELETE',
    path: `/users/${userId}/sessions/${sessionId}`,
  });
}

/* -------------------------------------------------------------------------- */
/*  Teams: the boundary that keeps subscribers and cross-area staff out       */
/* -------------------------------------------------------------------------- */

export const STAFF_TEAM_ID = 'trigon_staff';
export const ADMIN_TEAM_ID = 'trigon_admin';

export const areaTeamId = (areaId: string): string => `area_${areaId}`;

export async function findTeam(teamId: string): Promise<{ $id: string; name: string } | null> {
  try {
    return await appwriteRequest<{ $id: string; name: string }>({
      method: 'GET',
      path: `/teams/${teamId}`,
    });
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 404) return null;
    throw error;
  }
}

export async function createTeam(
  teamId: string,
  name: string,
  roles: string[]
): Promise<{ $id: string }> {
  return appwriteRequest<{ $id: string }>({
    method: 'POST',
    path: '/teams',
    body: { teamId, name, roles },
  });
}

export async function addUserToTeam(
  teamId: string,
  email: string,
  roles: string[]
): Promise<void> {
  await appwriteRequest({
    method: 'POST',
    path: `/teams/${teamId}/memberships`,
    body: { email, roles },
  });
}

export async function listTeamMemberships(
  teamId: string
): Promise<Array<{ $id: string; userId: string }>> {
  const result = await appwriteRequest<{
    memberships: Array<{ $id: string; userId: string }>;
  }>({
    method: 'GET',
    path: `/teams/${teamId}/memberships`,
  });
  return result.memberships ?? [];
}

/**
 * Permissions for a record, and the only definition of them in the codebase.
 *
 * READ-ONLY BY DESIGN. The browser reads Appwrite directly but has no write path:
 * every create, update and delete goes through /api/data, where the server checks
 * the caller's role and area before writing with the API key. A row therefore
 * grants `read` and nothing else.
 *
 * This is what closes the original hole. These strings used to include `update`
 * and `delete`, which meant a staff member's own Appwrite session - a real JWT
 * with their team memberships attached - could modify any row the staff team
 * could reach, without the server ever seeing the request. The server's
 * area-scoping was advisory, because Appwrite evaluated the write against the
 * browser, not against the server.
 *
 * A create can no longer be authorised either: Appwrite requires collection-level
 * `create` permission before a client may create a document at all, and the
 * collection permissions in scripts/provision-appwrite.ts no longer grant it.
 *
 * The staff collection stays admin-only: it holds each colleague's role and
 * permission grants, which a technician has no need to enumerate.
 */
export function permissionsForArea(
  areaId?: string | null,
  collectionId?: string
): string[] {
  if (collectionId === 'staff') {
    return ['read("team:trigon_admin")'];
  }

  const scopes = [ADMIN_TEAM_ID];
  if (areaId) scopes.push(areaTeamId(areaId));

  const permissions: string[] = [];
  for (const scope of scopes) {
    permissions.push(`read("team:${scope}")`);
  }
  if (!areaId) {
    // A record with no area stays visible to the whole staff team so a legacy row
    // with a missing areaId does not become invisible to every operator. It is
    // still not writable: the write policy treats an unresolvable area as
    // administrator-only.
    permissions.push('read("team:trigon_staff")');
  }
  return permissions;
}


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

/** Appwrite user label carrying the app's role for a given account. */
/**
 * Appwrite labels for an account.
 *
 * Appwrite 2.3 accepts only `[A-Za-z0-9]` in a label, at most 36 characters.
 * Probed against this project, each of the following is rejected with
 * "Invalid `labels` param":
 *
 *     role:Admin               the `:` separator
 *     staff-1790402026962      every id in this database is hyphenated
 *     staff_1790402026962      `_` is rejected too
 *
 * So the role is stored as one glued alnum token, and ids are omitted. Nothing
 * reads the id labels: `resolveStaffProfile` and `resolveSubscriberProfile` both
 * locate the record from `claims.entityId`, which is filled in from the staff or
 * customer collection at sign-in, not from a label.
 */
export function appwriteLabelsFor(input: {
  role: 'Admin' | 'Staff' | 'Customer';
  entityId?: string;
  staffId?: string;
  customerId?: string;
}): string[] {
  return ['trigon', `role${input.role.toLowerCase()}`];
}

/**
 * Reads back what `appwriteLabelsFor` wrote.
 *
 * `entityId`, `staffId` and `customerId` are always null now that ids cannot be
 * stored, and are kept in the shape for callers compiled against the old
 * signature. The `role:` branch reads labels written by an older build, which
 * could not be created on Appwrite 2.3 but may exist on an older project.
 */
export function parseAppwriteLabels(labels: string[]): {
  role: 'Admin' | 'Staff' | 'Customer' | null;
  entityId: string | null;
  staffId: string | null;
  customerId: string | null;
} {
  const glued = labels.find((label) => label.toLowerCase().startsWith('role'));
  const legacy = labels.find((label) => label.startsWith('role:'))?.slice('role:'.length) ?? null;
  const candidate = (glued ?? legacy)?.toLowerCase().replace(/^role:?/, '') ?? null;

  let role: 'Admin' | 'Staff' | 'Customer' | null = null;
  if (candidate === 'admin') role = 'Admin';
  else if (candidate === 'staff') role = 'Staff';
  else if (candidate === 'customer') role = 'Customer';

  return { role, entityId: null, staffId: null, customerId: null };
}
