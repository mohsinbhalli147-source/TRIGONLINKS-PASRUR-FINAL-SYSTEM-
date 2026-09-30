import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import config from './config';
import {
  AppwriteRestError,
  COLLECTIONS,
  appwriteLabelsFor,
  createUserSession,
  findUserByEmail,
  getDocument,
  getUser,
  isAppwriteUserActive,
  listDocuments,
  mintSessionJwt,
  parseAppwriteLabels,
  type AppwriteUser,
} from './appwrite-rest';
import {
  credentialCollectionId,
  isPlausibleCnic,
  normaliseCnic,
  verifyCnic,
} from './subscriber-credentials';

export type AppRole = 'Admin' | 'Staff' | 'Customer';

export interface SessionClaims {
  /** Appwrite account id. */
  uid: string;
  /** Appwrite session id, so logout can revoke the upstream session too. */
  appwriteSessionId: string;
  role: AppRole;
  /** Staff or customer record id inside the application database. */
  entityId: string;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthProfile {
  uid: string;
  role: AppRole;
  staffId?: string;
  customerId?: string;
  name: string;
  email: string;
  allowedSections: string[];
  allowedFunctions: string[];
  assignedAreaIds?: string[];
}

export class AuthError extends Error {
  public readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/*  Cookies + HMAC-signed session claims                                      */
/* -------------------------------------------------------------------------- */

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function hmac(input: string): string {
  return crypto.createHmac('sha256', config.session.secret).update(input).digest('base64url');
}

export function signSession(claims: SessionClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

/** Verifies structure, signature and expiry. Never trusts unverified input. */
export function verifySession(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = hmac(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!claims?.uid || !claims?.exp) return null;
  if (Date.now() >= claims.exp * 1000) return null;
  return claims;
}

export function setSessionCookie(res: Response, claims: SessionClaims): void {
  const maxAge = Math.max(0, claims.exp * 1000 - Date.now());
  res.cookie(config.session.cookieName, signSession(claims), {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge,
  });
}

export function clearSessionCookie(res: Response): void {
  const base = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.nodeEnv === 'production',
    path: '/',
  };
  res.clearCookie(config.session.cookieName, base);
  res.clearCookie(GRANT_COOKIE_NAME, base);
}

/* -------------------------------------------------------------------------- */
/*  Grant cookie                                                              */
/*                                                                            */
/*  Holds the Appwrite session cookie, never any token handed to JavaScript.   */
/*  Appwrite 2.x issues a 15 minute JWT, so a long lived session has to exist  */
/*  somewhere for the server to mint replacements from; that is this cookie,  */
/*  and it never leaves the server. The browser only ever holds a JWT that     */
/*  expires on its own, and signing out revokes the session behind it.         */
/* -------------------------------------------------------------------------- */

export const GRANT_COOKIE_NAME = 'trigon_grant';

export interface SessionGrant {
  /** The `a_session_<project>=<value>` cookie, replayed to mint fresh JWTs. */
  sessionCookie: string;
  sessionId: string;
  sessionExpiresAt: string;
}

export function setGrantCookie(res: Response, claims: SessionClaims, grant: SessionGrant): void {
  const maxAge = Math.max(0, claims.exp * 1000 - Date.now());
  const payload = Buffer.from(
    JSON.stringify({ ...grant, appwriteSessionId: claims.appwriteSessionId })
  ).toString('base64url');
  res.cookie(GRANT_COOKIE_NAME, `${payload}.${hmac(payload)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge,
  });
}

export function readGrantCookie(req: Request): SessionGrant | null {
  const raw = parseCookies(req)[GRANT_COOKIE_NAME];
  if (!raw) return null;

  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;

  const expected = hmac(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionGrant;
    if (!parsed?.sessionCookie || !parsed?.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** What the browser is handed: a short lived JWT, never the session cookie. */
export interface AppwriteGrantResponse {
  token: string;
  secret: string;
  sessionId: string;
  expiresAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Rate limiting (in-process; swap for Redis before horizontal scaling)       */
/* -------------------------------------------------------------------------- */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Keep the limiter map from growing without bound on a long-lived process.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000);
sweep.unref();

/* -------------------------------------------------------------------------- */
/*  Application record shapes used during authentication                       */
/* -------------------------------------------------------------------------- */

interface StaffAuthRecord {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  status: string;
  allowedSections?: string[];
  allowedFunctions?: string[];
  assignedAreaIds?: string[];
}

interface CustomerAuthRecord {
  id: string;
  name: string;
  email?: string;
  username?: string;
  mobile?: string;
  cnic?: string;
  status: string;
}

/**
 * Subscribers are looked up by user ID only.
 *
 * The previous build indexed subscribers by CNIC and mobile as well, which
 * would have let a caller test arbitrary identifiers against the subscriber
 * base. Only the user ID the ISP issued is accepted as a lookup key; the CNIC is
 * verified, never used to find the record.
 */
function normalise(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

async function readCollection<T>(collectionId: string): Promise<T[]> {
  try {
    return (await listDocuments<T>(collectionId, { limit: 5000 })) as unknown as T[];
  } catch (error) {
    if (error instanceof AppwriteRestError) return [];
    throw error;
  }
}

/** Cached subscriber user-ID index. PII never leaves the server. */
let customerIndex: { at: number; byUserId: Map<string, CustomerAuthRecord> } | null = null;
const CUSTOMER_INDEX_TTL_MS = 5 * 60_000;

async function getCustomerIndex(): Promise<Map<string, CustomerAuthRecord>> {
  if (customerIndex && Date.now() - customerIndex.at < CUSTOMER_INDEX_TTL_MS) {
    return customerIndex.byUserId;
  }

  const rows = await readCollection<CustomerAuthRecord>(COLLECTIONS.customers);
  const map = new Map<string, CustomerAuthRecord>();
  for (const row of rows) {
    for (const key of [row.username, row.id]) {
      if (!key) continue;
      const normalised = normalise(key);
      // First match wins so a user ID cannot be shadowed by a later record.
      if (!map.has(normalised)) map.set(normalised, row);
    }
  }

  customerIndex = { at: Date.now(), byUserId: map };
  return map;
}

export function invalidateIdentityCaches(): void {
  customerIndex = null;
}

async function findCustomerByUserId(userId: string): Promise<CustomerAuthRecord | null> {
  const index = await getCustomerIndex();
  return index.get(normalise(userId)) ?? null;
}

async function findStaffByIdentifier(identifier: string): Promise<StaffAuthRecord | null> {
  const rows = await readCollection<StaffAuthRecord>(COLLECTIONS.staff);
  const key = normalise(identifier);
  return (
    rows.find(
      (row) => normalise(row.email) === key || (row.username && normalise(row.username) === key)
    ) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/*  Login                                                                     */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Login: two independent paths                                             */
/*                                                                            */
/*  Staff authenticate against an Appwrite account and receive a real Appwrite */
/*  session token, which the browser uses for direct data access.             */
/*                                                                            */
/*  Subscribers authenticate with user ID + CNIC, verified here against a     */
/*  PBKDF2 hash. They get no Appwrite token because they have no Appwrite     */
/*  access to grant; everything they see is served by /api/portal.            */
/* -------------------------------------------------------------------------- */

function accountEmailForStaff(staff: StaffAuthRecord): string {
  return staff.email.trim();
}

export interface StaffLoginResult {
  /** The 15 minute JWT the browser presents to Appwrite. */
  appwrite: AppwriteGrantResponse;
  /** Kept server side, in the httpOnly grant cookie. */
  grant: SessionGrant;
  claims: SessionClaims;
  profile: AuthProfile;
}

export interface SubscriberLoginResult {
  claims: SessionClaims;
  profile: AuthProfile;
}

export async function loginStaff(input: {
  identifier: string;
  password: string;
}): Promise<StaffLoginResult> {
  const identifier = input.identifier.trim();
  const password = input.password;
  if (!identifier || !password) {
    throw new AuthError('Enter your sign-in details.', 400);
  }

  const staff = await findStaffByIdentifier(identifier);
  if (!staff) {
    // Deliberately identical to the "wrong password" error so this endpoint
    // cannot be used to enumerate staff accounts.
    throw new AuthError('Incorrect email or password.');
  }
  if (normalise(staff.status) !== 'active') {
    throw new AuthError('This staff account is not active. Contact your administrator.', 403);
  }

  const accountEmail = accountEmailForStaff(staff);
  const user = await findUserByEmail(accountEmail);
  if (!user) {
    throw new AuthError(
      'This staff account has not been provisioned yet. Run "npm run provision".',
      403
    );
  }

  let session: Awaited<ReturnType<typeof createUserSession>>;
  try {
    session = await createUserSession(accountEmail, password);
  } catch (error) {
    if (error instanceof AppwriteRestError && (error.status === 401 || error.status === 429)) {
      throw new AuthError('Incorrect email or password.');
    }
    throw error;
  }

  const profile: AuthProfile = {
    uid: user.$id,
    role: staff.role === 'Admin' ? 'Admin' : 'Staff',
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    allowedSections: staff.allowedSections ?? ['dashboard'],
    allowedFunctions: staff.allowedFunctions ?? [],
    assignedAreaIds: staff.assignedAreaIds,
  };

  return {
    appwrite: {
      token: session.token,
      secret: session.secret,
      sessionId: session.$id,
      expiresAt: session.expireAt,
    },
    grant: {
      sessionCookie: session.sessionCookie,
      sessionId: session.$id,
      sessionExpiresAt: session.sessionExpiresAt,
    },
    claims: buildClaims({
      uid: user.$id,
      appwriteSessionId: session.$id,
      role: profile.role,
      entityId: staff.id,
      name: profile.name,
      email: profile.email,
    }),
    profile,
  };
}

/**
 * A fresh 15 minute JWT for a session that is already established.
 *
 * The grant cookie carries the Appwrite session cookie, so this needs no
 * password and no re-authentication - only proof that the caller still holds
 * both signed cookies. Returns null when Appwrite no longer recognises the
 * session, which is the signal to send the user back to the sign-in form.
 */
export async function refreshAppwriteGrant(grant: SessionGrant): Promise<AppwriteGrantResponse | null> {
  try {
    const { jwt, expireAt } = await mintSessionJwt(grant.sessionCookie);
    return { token: jwt, secret: '', sessionId: grant.sessionId, expiresAt: expireAt };
  } catch (error) {
    if (error instanceof AppwriteRestError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}

export async function loginSubscriber(input: {
  userId: string;
  cnic: string;
}): Promise<SubscriberLoginResult> {
  const userId = input.userId.trim();
  const cnicDigits = normaliseCnic(input.cnic);

  if (!userId) throw new AuthError('Enter your Trigon Links user ID.', 400);
  if (!isPlausibleCnic(cnicDigits)) {
    throw new AuthError('Enter the 13 digit CNIC number registered with your connection.', 400);
  }

  // Resolve by user ID only. Matching on CNIC as the lookup key would let a
  // caller test arbitrary CNICs against the subscriber base.
  const customer = await findCustomerByUserId(userId);
  if (!customer) throw new AuthError('Incorrect user ID or CNIC number.');

  if (normalise(customer.status) !== 'active') {
    throw new AuthError('This connection is not active. Please contact support.', 403);
  }

  // Reject a CNIC that is well-formed but belongs to a different subscriber, so
  // a wrong ID plus a valid CNIC cannot be brute-forced one user at a time.
  if (normaliseCnic(customer.cnic) !== cnicDigits) {
    throw new AuthError('Incorrect user ID or CNIC number.');
  }

  const stored = await readSubscriberCredential(customer.id);
  if (stored) {
    if (!verifyCnic(cnicDigits, stored)) {
      throw new AuthError('Incorrect user ID or CNIC number.');
    }
  } else if (!config.allowUnhashedSubscriberFallback) {
    throw new AuthError(
      'This connection has no sign-in set up yet. Run "npm run provision".',
      403
    );
  }

  const profile: AuthProfile = {
    // No Appwrite account, so the session identity is the subscriber record.
    uid: `subscriber:${customer.id}`,
    role: 'Customer',
    customerId: customer.id,
    name: customer.name,
    email: customer.email ?? '',
    allowedSections: ['customer-portal'],
    allowedFunctions: [],
  };

  return {
    claims: buildClaims({
      uid: profile.uid,
      // Subscribers never hold an Appwrite session, so there is no upstream
      // session to revoke on sign-out.
      appwriteSessionId: '',
      role: 'Customer',
      entityId: customer.id,
      name: profile.name,
      email: profile.email,
    }),
    profile,
  };
}

function buildClaims(
  input: Omit<SessionClaims, 'iat' | 'exp'>
): SessionClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    ...input,
    iat: now,
    exp: now + config.session.ttlHours * 3600,
  };
}

async function readSubscriberCredential(
  customerId: string
): Promise<{ hash: string; salt: string; iterations: number } | null> {
  const row = await getDocument<Record<string, unknown>>(
    credentialCollectionId,
    customerId
  );
  if (!row) return null;
  const hash = typeof row.hash === 'string' ? row.hash : '';
  const salt = typeof row.salt === 'string' ? row.salt : '';
  const iterations = typeof row.iterations === 'number' ? row.iterations : 0;
  if (!hash || !salt) return null;
  return { hash, salt, iterations };
}

/** Staff profile from the database, so permission changes take effect at once. */
export async function resolveStaffProfile(claims: SessionClaims): Promise<AuthProfile> {
  const user = await getUser(claims.uid);
  if (!isAppwriteUserActive(user)) {
    throw new AuthError('This account is no longer active.', 403);
  }

  const labels = parseAppwriteLabels(user.labels ?? []);
  if (labels.role && labels.role !== claims.role) {
    throw new AuthError('Your role changed. Please sign in again.', 403);
  }

  const rows = await readCollection<StaffAuthRecord>(COLLECTIONS.staff);
  const staff = rows.find((row) => row.id === claims.entityId);
  if (!staff) throw new AuthError('This account has no staff record.', 403);
  if (normalise(staff.status) !== 'active') {
    throw new AuthError('This staff account is not active.', 403);
  }

  return {
    uid: claims.uid,
    role: staff.role === 'Admin' ? 'Admin' : 'Staff',
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    allowedSections: staff.allowedSections ?? ['dashboard'],
    allowedFunctions: staff.allowedFunctions ?? [],
    assignedAreaIds: staff.assignedAreaIds,
  };
}

/** Subscriber profile, re-read so a suspension takes effect immediately. */
export async function resolveSubscriberProfile(
  claims: SessionClaims
): Promise<AuthProfile> {
  const rows = await readCollection<CustomerAuthRecord>(COLLECTIONS.customers);
  const customer = rows.find((row) => row.id === claims.entityId);
  if (!customer) throw new AuthError('This account has no subscriber record.', 403);
  if (normalise(customer.status) !== 'active') {
    throw new AuthError('This connection is not active. Please contact support.', 403);
  }
  return {
    uid: claims.uid,
    role: 'Customer',
    customerId: customer.id,
    name: customer.name,
    email: customer.email ?? '',
    allowedSections: ['customer-portal'],
    allowedFunctions: [],
  };
}

/** Routes to the right resolver for whatever role the session claims. */
export async function resolveProfile(claims: SessionClaims): Promise<AuthProfile> {
  if (claims.role === 'Customer') return resolveSubscriberProfile(claims);
  return resolveStaffProfile(claims);
}

export { appwriteLabelsFor, type AppwriteUser };
