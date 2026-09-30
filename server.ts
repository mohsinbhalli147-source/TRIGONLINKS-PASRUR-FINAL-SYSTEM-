import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import config, { ROOT_DIR, assertConfigValid, isProduction } from './server/config';
import {
  AuthError,
  type SessionClaims,
  clearSessionCookie,
  invalidateIdentityCaches,
  loginStaff,
  loginSubscriber,
  resolveStaffProfile,
  resolveSubscriberProfile,
  parseCookies,
  rateLimit,
  readGrantCookie,
  refreshAppwriteGrant,
  setGrantCookie,
  setSessionCookie,
  STAFF_SESSION_COOKIE,
  SUBSCRIBER_SESSION_COOKIE,
  verifySession,
} from './server/auth';
import {
  AppwriteRestError,
  COLLECTIONS,
  createUserSession,
  deleteUserSession,
  findUserByEmail,
  listDocuments,
  permissionsForArea,
  updateUserPassword,
  upsertDocument,
} from './server/appwrite-rest';
import { registerWriteRoutes } from './server/write-routes';

assertConfigValid();

const app = express();
app.set('trust proxy', config.security.trustProxy);
app.disable('x-powered-by');

/* -------------------------------------------------------------------------- */
/*  Security headers                                                          */
/* -------------------------------------------------------------------------- */

const appwriteOrigin = new URL(config.appwrite.endpoint).origin;
const appwriteWs = appwriteOrigin.replace(/^http/, 'ws');

/**
 * Vite's hot-reload socket.
 *
 * Without it the dev server's websocket is refused by this policy, so an edit is
 * not picked up and the page has to be hard-refreshed by hand - which is also
 * how a stale bundle survives a fix and looks like the fix did not work.
 * Development only: in production there is no dev server to connect to, and the
 * wildcard below is exactly the sort of thing that should not ship.
 */
const viteHmr = isProduction ? [] : ['ws://localhost:*', 'ws://127.0.0.1:*'];

const csp = [
  "default-src 'self'",
  // Tailwind injects a stylesheet at runtime and several views use style props.
  "style-src 'self' 'unsafe-inline'",
  ...(isProduction
    ? ["script-src 'self'"]
    : ["script-src 'self' 'unsafe-inline' 'unsafe-eval'"]),
  `connect-src 'self' ${appwriteOrigin} ${appwriteWs} https://www.googleapis.com https://accounts.google.com ${viteHmr.join(' ')}`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src https://accounts.google.com",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', config.security.frameOptions);
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // Allows the Google OAuth popup while still isolating the main document.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/**
 * Rejects cross-origin state changes. Combined with SameSite=Strict cookies this
 * closes off CSRF without a token round-trip.
 */
function assertSameOrigin(req: Request): void {
  const origin = req.headers.origin;
  if (!origin) return; // same-origin fetch may omit it
  try {
    if (new URL(origin).host !== req.headers.host) {
      throw new AuthError('Cross-origin request rejected.', 403);
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('Malformed Origin header.', 403);
  }
}

/**
 * Staff session.
 *
 * Reads the staff cookie specifically, never the subscriber one. Both apps live
 * on the same host and a cookie ignores the port, so a subscriber signing in
 * used to overwrite the staff session and every panel read then failed with a
 * 403 that the client read as "session lost" - which closed the form the
 * operator was in the middle of editing.
 */
function requireSession(req: Request): SessionClaims {
  const claims = verifySession(parseCookies(req)[STAFF_SESSION_COOKIE]);
  if (!claims) throw new AuthError('Your session has expired. Please sign in again.', 401);
  if (claims.role === 'Customer') {
    throw new AuthError('This is a subscriber session. Please sign in to the staff panel.', 403);
  }
  return claims;
}

function requireSubscriber(req: Request): SessionClaims {
  const claims = verifySession(parseCookies(req)[SUBSCRIBER_SESSION_COOKIE]);
  if (!claims) throw new AuthError('Your session has expired. Please sign in again.', 401);
  if (claims.role !== 'Customer') {
    throw new AuthError('This is a staff session. Please sign in to the subscriber app.', 403);
  }
  return claims;
}

function isWeakPassword(password: string): boolean {
  if (password.length < 12) return true;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return true;
  const known = [
    'admin123',
    'staff123',
    'trigon@123',
    'pass@123',
    '123456',
    'password',
    'admin@trigon2026!',
    'pass@pasrur12',
    'pass@sialkotcantt',
    'pass@daska12',
    'pass@crown2024',
  ];
  return known.includes(password.toLowerCase());
}

function generatePassword(): string {
  // Ambiguous glyphs removed so an operator can read it aloud to a subscriber.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(20);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `Tg-${chars.slice(0, 4)}-${chars.slice(4, 10)}-${chars.slice(10, 16)}`;
}

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

/* -------------------------------------------------------------------------- */
/*  Authentication API                                                        */
/* -------------------------------------------------------------------------- */

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, environment: config.nodeEnv });
});

/**
 * Non-secret connection details for the browser. Keeping these server-side
 * means the project and database ids are defined in exactly one place.
 */
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    appwrite: {
      endpoint: config.appwrite.endpoint,
      projectId: config.appwrite.projectId,
      databaseId: config.appwrite.databaseId,
    },
  });
});

/**
 * Reports whether the Appwrite project is provisioned, so the client can show an
 * actionable setup screen instead of failing with an empty state.
 */
app.get(
  '/api/auth/status',
  asyncRoute(async (_req, res) => {
    try {
      const collections = await listDocuments(COLLECTIONS.staff, { limit: 1 });
      res.json({ ok: true, provisioned: true, staffCount: collections.length > 0 });
    } catch (error) {
      const missing =
        error instanceof AppwriteRestError && (error.status === 404 || error.status === 401);
      res.status(missing ? 503 : 500).json({
        ok: false,
        provisioned: false,
        message: missing
          ? 'The Appwrite project is not provisioned. Run "npm run provision".'
          : 'Could not reach Appwrite.',
      });
    }
  })
);

/**
 * Staff sign-in. Returns a real Appwrite session token so the browser can read
 * and write operational data directly.
 */
app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);

    const identifier = String(req.body?.identifier ?? '');
    const limit = rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new AuthError('Too many attempts. Please wait and try again.', 429);
    }

    const result = await loginStaff({
      identifier,
      password: String(req.body?.password ?? ''),
    });

    setSessionCookie(res, result.claims);
    setGrantCookie(res, result.claims, result.grant);
    res.json({ appwrite: result.appwrite, profile: result.profile });
  })
);

/**
 * Subscriber sign-in: Trigon Links user ID plus the CNIC registered against the
 * connection.
 *
 * Kept on a separate path from staff sign-in with its own rate limit, and it
 * returns no Appwrite token at all: subscribers have no data access in Appwrite,
 * so there is nothing to grant. Everything they see is served by /api/portal.
 */
app.post(
  '/api/auth/subscriber-login',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);

    // Tighter than the staff limit: a subscriber attempt also costs a PBKDF2
    // derivation, and the user-ID + CNIC pair is the only thing protecting the
    // account.
    const limit = rateLimit(
      `subscriber:${clientIp(req)}`,
      5,
      10 * 60_000
    );
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new AuthError(
        'Too many attempts. Please wait a few minutes, or call the helpline.',
        429
      );
    }

    const result = await loginSubscriber({
      userId: String(req.body?.userId ?? ''),
      cnic: String(req.body?.cnic ?? ''),
    });

    // No grant cookie: this session never touches Appwrite. The cookie name is
    // the subscriber one so signing in here cannot replace a staff session in
    // the panel - they share a host and cookies ignore the port.
    setSessionCookie(res, result.claims, SUBSCRIBER_SESSION_COOKIE);
    res.json({ profile: result.profile });
  })
);

app.post(
  '/api/auth/logout',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);
    const cookies = parseCookies(req);

    // Both names are cleared, because either app can call this and the other
    // one's cookie is sitting in the same jar.
    const claims =
      verifySession(cookies[STAFF_SESSION_COOKIE]) ?? verifySession(cookies[SUBSCRIBER_SESSION_COOKIE]);
    clearSessionCookie(res);
    res.clearCookie(SUBSCRIBER_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.nodeEnv === 'production',
      path: '/',
    });

    if (claims?.appwriteSessionId) {
      // Revoke upstream so the token in the browser stops working immediately.
      try {
        await deleteUserSession(claims.uid, claims.appwriteSessionId);
      } catch (error) {
        if (!(error instanceof AppwriteRestError) || error.status !== 404) throw error;
      }
    }
    res.json({ ok: true });
  })
);

/**
 * Restores a session after a reload. The httpOnly cookies are the only thing
 * the browser keeps: one proves who the caller is, the other carries the
 * Appwrite session cookie. Nothing sensitive is ever handed to JavaScript for
 * storage, and the session is revoked upstream as soon as sign-out happens.
 */
app.get(
  '/api/auth/session',
  asyncRoute(async (req, res) => {
    const claims = requireSession(req);

    // A subscriber session is server-only: there is no Appwrite token to hand
    // back, and /api/auth/session is how the customer app restores its session.
    if (claims.role === 'Customer') {
      const profile = await resolveSubscriberProfile(claims);
      res.json({ profile, appwrite: null });
      return;
    }

    const grant = readGrantCookie(req);
    if (!grant || grant.sessionId !== claims.appwriteSessionId) {
      // The grant is missing or was tampered with: ask for a fresh sign-in
      // rather than trying to rebuild a session without the password.
      clearSessionCookie(res);
      throw new AuthError('Your session has expired. Please sign in again.', 401);
    }

    // The JWT from sign-in has almost certainly expired while the tab was shut,
    // so a reload always trades the session cookie for a new one.
    const appwrite = await refreshAppwriteGrant(grant);
    if (!appwrite) {
      clearSessionCookie(res);
      throw new AuthError('Your session has expired. Please sign in again.', 401);
    }

    const profile = await resolveStaffProfile(claims);
    res.json({ profile, appwrite });
  })
);

/**
 * Renews the browser's Appwrite JWT ahead of it expiring.
 *
 * Appwrite 2.x issues 15 minute tokens, so a panel left open all day would
 * otherwise start failing every read. The grant cookie still holds the
 * underlying session, so this needs no password, and it hands back only a new
 * short lived JWT.
 */
app.post(
  '/api/auth/refresh',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);

    const claims = requireSession(req);
    if (claims.role === 'Customer') {
      // Subscribers hold no Appwrite grant, so there is nothing to renew.
      res.json({ appwrite: null });
      return;
    }

    const grant = readGrantCookie(req);
    if (!grant || grant.sessionId !== claims.appwriteSessionId) {
      clearSessionCookie(res);
      throw new AuthError('Your session has expired. Please sign in again.', 401);
    }

    const limit = rateLimit(`refresh:${clientIp(req)}`, 60, 5 * 60_000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new AuthError('Too many refresh attempts. Please sign in again.', 429);
    }

    const appwrite = await refreshAppwriteGrant(grant);
    if (!appwrite) {
      clearSessionCookie(res);
      throw new AuthError('Your session has expired. Please sign in again.', 401);
    }

    res.json({ appwrite });
  })
);

/** Staff-only: change your own account password. */
app.post(
  '/api/auth/change-password',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);
    const claims = requireSession(req);
    if (claims.role === 'Customer') {
      throw new AuthError('This endpoint is for staff accounts.', 403);
    }

    const newPassword = String(req.body?.newPassword ?? '');
    if (isWeakPassword(newPassword)) {
      throw new AuthError(
        'Choose a password of at least 12 characters mixing upper case, lower case and a number.',
        400
      );
    }

    const accountEmail = await findStaffByEmailSafely(claims.entityId);
    if (!accountEmail) {
      throw new AuthError('No account is linked to this record.', 403);
    }

    // Re-authenticate before allowing a change so a stolen cookie cannot be
    // used to lock the real owner out.
    try {
      await createUserSession(accountEmail, String(req.body?.currentPassword ?? ''));
    } catch (error) {
      if (error instanceof AppwriteRestError && error.status === 401) {
        throw new AuthError('Your current password is incorrect.', 403);
      }
      throw error;
    }

    await updateUserPassword(claims.uid, newPassword);
    clearSessionCookie(res);
    res.json({ ok: true, message: 'Password updated. Please sign in again.' });
  })
);

/**
 * Admin-only: sets a staff member's password.
 *
 * Omit newPassword and the server generates a strong one, returned exactly once.
 * Supplying one lets an administrator set a password the user chose.
 *
 * There is deliberately no subscriber equivalent: subscribers sign in with their
 * CNIC, which the office records, so there is no password to reset. To change
 * what a subscriber signs in with, correct the CNIC on their customer record and
 * re-run "npm run provision".
 */
app.post(
  '/api/admin/reset-password',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);
    const claims = requireSession(req);
    if (claims.role !== 'Admin') throw new AuthError('Administrator access required.', 403);

    const limit = rateLimit(`reset:${claims.uid}`, 20, 60 * 60_000);
    if (!limit.allowed) throw new AuthError('Too many resets. Try again later.', 429);

    const entityId = String(req.body?.entityId ?? '');
    if (!entityId) throw new AuthError('entityId is required.', 400);

    const requested = String(req.body?.newPassword ?? '').trim();
    if (requested && isWeakPassword(requested)) {
      throw new AuthError(
        'Choose a password of at least 12 characters mixing upper case, lower case and a number.',
        400
      );
    }

    const accountEmail = await findStaffByEmailSafely(entityId);
    if (!accountEmail) throw new AuthError('No account found for that record.', 404);

    const user = await findUserByEmail(accountEmail);
    if (!user) throw new AuthError('That account has not been provisioned yet.', 404);

    const password = requested || generatePassword();
    await updateUserPassword(user.$id, password);
    invalidateIdentityCaches();

    // The plaintext exists only in this response. It is never logged or stored.
    res.json({ ok: true, generated: !requested, password, email: accountEmail });
  })
);

async function findStaffByEmailSafely(staffId: string): Promise<string | null> {
  const rows = await listDocuments<{ email?: string }>(COLLECTIONS.staff, { limit: 5000 });
  return rows.find((row) => row.id === staffId && row.email)?.email ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Data write API - the application's only write path                          */
/*                                                                            */
/*  The browser reads Appwrite directly but does not write to it. Every        */
/*  create, update and delete below is authorized server-side against the      */
/*  record as it is actually stored, then written with the API key. See         */
/*  server/write-authz.ts for the policy.                                      */
/* -------------------------------------------------------------------------- */

registerWriteRoutes(app, {
  requireSession,
  resolveProfile: resolveStaffProfile,
  assertSameOrigin,
  asyncRoute,
});

/* -------------------------------------------------------------------------- */
/*  Subscriber portal                                                         */
/*                                                                            */
/*  Subscribers have no Appwrite read access to any collection. Everything    */
/*  they see is assembled here from the caller's own session, so a subscriber  */
/*  cannot reach another subscriber's data even with a valid token.           */
/* -------------------------------------------------------------------------- */

/**
 * Exactly which fields a subscriber may see.
 *
 * The portal returns an explicit projection rather than the stored record. If a
 * staff-only field is ever added to a customer document, it cannot reach a
 * subscriber's app by accident, because it was never in the allowlist.
 */
const PORTAL_PROFILE_FIELDS = [
  'id', 'name', 'username', 'email', 'mobile', 'cnic',
  'address', 'areaName', 'packageName', 'packageSpeed',
  'monthlyFee', 'totalMonthly', 'ipCharges', 'iptvCharges', 'discount', 'discountMonthly',
  'connectionType', 'device', 'ipAddress', 'gateway',
  'pppoeUsername', 'pppoePassword',
  'status', 'installDate', 'billingDate', 'hasIptv',
] as const;

const PORTAL_INVOICE_FIELDS = [
  'id', 'invoiceNumber', 'month', 'amount', 'paidAmount', 'remainingAmount',
  'status', 'issueDate', 'dueDate', 'paidDate', 'paymentMethod',
] as const;

const PORTAL_PAYMENT_FIELDS = [
  'id', 'receiptNumber', 'amount', 'method', 'date', 'discount',
] as const;

const PORTAL_COMPLAINT_FIELDS = [
  'id', 'ticketNumber', 'subject', 'description', 'priority', 'status',
  'createdAt', 'assignedStaff',
] as const;

const PORTAL_CONNECTION_FIELDS = [
  'id', 'customerName', 'packageName', 'packageSpeed', 'areaName',
  'status', 'connectionType', 'device', 'opticalPowerDbm', 'installDate',
] as const;

function project<T extends Record<string, unknown>>(
  row: T,
  fields: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (row[field] !== undefined) out[field] = row[field];
  }
  return out;
}

app.get(
  '/api/portal',
  asyncRoute(async (req, res) => {
    const claims = requireSubscriber(req);

    const [customers, invoices, payments, complaints, connections] = await Promise.all([
      listDocuments<Record<string, unknown>>(COLLECTIONS.customers, { limit: 5000 }),
      listDocuments<Record<string, unknown>>(COLLECTIONS.invoices, { limit: 5000 }),
      listDocuments<Record<string, unknown>>(COLLECTIONS.payments, { limit: 5000 }),
      listDocuments<Record<string, unknown>>(COLLECTIONS.complaints, { limit: 5000 }),
      listDocuments<Record<string, unknown>>(COLLECTIONS.connections, { limit: 5000 }),
    ]);

    const mine = customers.find((row) => row.id === claims.entityId);
    if (!mine) throw new AuthError('No subscriber record is linked to this account.', 403);

    // Matching is on customerId only. An earlier version also matched a row's
    // own `id`, which could pull in an unrelated record that happened to share
    // the identifier; a subscriber only ever sees rows that name them.
    const ownedByCaller = (rows: Array<Record<string, unknown>>) =>
      rows.filter((row) => row.customerId === claims.entityId);

    const newestFirst = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));

    res.json({
      // The subscriber legitimately sees their own network credentials, so they
      // are in the allowlist - and only ever for this one subscriber.
      profile: project(mine, PORTAL_PROFILE_FIELDS),
      invoices: ownedByCaller(invoices).sort(newestFirst).map((r) => project(r, PORTAL_INVOICE_FIELDS)),
      payments: ownedByCaller(payments).sort(newestFirst).map((r) => project(r, PORTAL_PAYMENT_FIELDS)),
      complaints: ownedByCaller(complaints).sort(newestFirst).map((r) => project(r, PORTAL_COMPLAINT_FIELDS)),
      connections: ownedByCaller(connections).map((r) => project(r, PORTAL_CONNECTION_FIELDS)),
    });
  })
);

app.post(
  '/api/portal/complaints',
  asyncRoute(async (req, res) => {
    assertSameOrigin(req);
    const claims = requireSubscriber(req);

    const subject = String(req.body?.subject ?? '').trim().slice(0, 140);
    const message = String(req.body?.message ?? '').trim().slice(0, 2000);
    const priority = ['Low', 'Medium', 'High', 'Urgent'].includes(String(req.body?.priority))
      ? String(req.body?.priority)
      : 'Medium';

    if (subject.length < 3 || message.length < 5) {
      throw new AuthError('Add a short subject and a description of the problem.', 400);
    }

    const customers = await listDocuments<{ name?: string; mobile?: string; username?: string; areaId?: string }>(
      COLLECTIONS.customers,
      { limit: 5000 }
    );
    const mine = customers.find((row) => row.id === claims.entityId);
    if (!mine) throw new AuthError('No subscriber record is linked to this account.', 403);

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const existing = await listDocuments<{ ticketNumber?: string }>(COLLECTIONS.complaints, {
      limit: 5000,
    });
    const sequence = existing.filter((row) => row.ticketNumber?.startsWith(`TKT-${stamp}`)).length + 1;

    const record = {
      id: `cmp-${claims.entityId}-${Date.now().toString(36)}`,
      ticketNumber: `TKT-${stamp}-${String(sequence).padStart(4, '0')}`,
      customerId: claims.entityId,
      customerName: mine.name ?? 'Subscriber',
      customerMobile: mine.mobile ?? '',
      subject,
      description: message,
      priority,
      status: 'Open',
      assignedStaff: 'Unassigned',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await upsertDocument(
      COLLECTIONS.complaints,
      record.id,
      record,
      // A record written without a permission list is invisible to every client
      // once document security is on, so subscriber complaints were reaching the
      // database and never reaching the staff panel. The area comes from the
      // subscriber's own record, and the list is read-only like every other row.
      permissionsForArea(mine.areaId ?? null, COLLECTIONS.complaints)
    );
    res.status(201).json({ ok: true, complaint: record });
  })
);


/**
 * Staff-only, audited retrieval of a subscriber's network credentials.
 *
 * These secrets are stripped from the browser's local cache, so they are read
 * on demand here and every access is written to the audit log.
 */
app.get(
  '/api/customers/:customerId/credentials',
  asyncRoute(async (req, res) => {
    const claims = requireSession(req);
    if (claims.role === 'Customer') {
      // A subscriber gets their own credentials from /api/portal instead.
      throw new AuthError('This endpoint is for staff accounts.', 403);
    }

    const limit = rateLimit(`cred:${claims.uid}`, 120, 60 * 60_000);
    if (!limit.allowed) throw new AuthError('Too many requests. Try again shortly.', 429);

    const customerId = String(req.params.customerId ?? '');
    if (!customerId) throw new AuthError('customerId is required.', 400);

    const rows = await listDocuments<Record<string, unknown>>(COLLECTIONS.customers, {
      limit: 5000,
    });
    const customer = rows.find((row) => row.id === customerId);
    if (!customer) throw new AuthError('No such subscriber.', 404);

    await appendActivityLog({
      actor: claims,
      action: 'Subscriber Credentials Viewed',
      collection: 'customers',
      details: `Viewed network credentials for ${String(customer.username ?? customer.name ?? customerId)}.`,
    });

    res.json({
      customerId,
      username: customer.username ?? null,
      pppoePassword: customer.pppoePassword ?? null,
      ipAddress: customer.ipAddress ?? null,
      gateway: customer.gateway ?? null,
      macAddress: customer.macAddress ?? null,
    });
  })
);

/** Writes an audit entry from the server so privileged reads leave a trace. */
async function appendActivityLog(input: {
  actor: SessionClaims;
  action: string;
  collection: string;
  details: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const id = `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await upsertDocument(
      COLLECTIONS.activityLogs,
      id,
      {
        id,
        timestamp: now,
        userEmail: input.actor.email,
        userName: input.actor.name,
        action: input.action,
        collection: input.collection,
        details: input.details,
      },
      // Read-only, and visible to the whole staff team: an audit entry belongs to
      // no area. Without an explicit list this row would be invisible to everyone
      // but the server, which is exactly what an audit log should never be.
      permissionsForArea(null, COLLECTIONS.activityLogs)
    );
  } catch (error) {
    // An audit write must never block the operation being audited.
    console.error('[audit] could not append activity log:', error);
  }
}

/* -------------------------------------------------------------------------- */
/*  Static assets / Vite dev server                                            */
/* -------------------------------------------------------------------------- */

async function startServer(): Promise<void> {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: ROOT_DIR,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.join(ROOT_DIR, 'dist'), {
        maxAge: '1y',
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(ROOT_DIR, 'dist', 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof AuthError ? error.status : 500;
    const message =
      error instanceof AppwriteRestError
        ? 'The data service rejected the request.'
        : error instanceof Error
          ? error.message
          : 'Unexpected server error.';

    if (status >= 500) {
      // Never leak stack traces or upstream credentials to the client.
      console.error('[server]', error);
    }
    res.status(status).json({ ok: false, message: status >= 500 ? 'Unexpected server error.' : message });
  });

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Trigon Links server listening on http://0.0.0.0:${config.port} (${config.nodeEnv})`);
    if (!config.bootstrap.adminEmail) {
      console.log('ADMIN_EMAIL not set - run "npm run provision" to create the first administrator.');
    }
  });

  // Without this, a busy port crashes the process with a raw stack trace.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${config.port} is already in use.\n` +
          'Stop whatever is listening there, or set PORT in .env to a free port.\n'
      );
    } else {
      console.error('[server] listen failed:', error.message);
    }
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error('[server] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});

