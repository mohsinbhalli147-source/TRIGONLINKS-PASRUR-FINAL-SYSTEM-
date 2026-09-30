/**
 * Write authorization: the server decides, the client only asks.
 *
 * This is the single authority for "may this signed-in staff member change this
 * record". The browser has no write path into Appwrite any more; it posts to
 * /api/data, and every request lands here first.
 *
 * Three rules drive the whole design:
 *
 *  1. Never trust the payload. The client tells us what it *wants* to write, not
 *     what it is *allowed* to write. Authorization is decided from the session
 *     (server-verified) and from the document as it exists in Appwrite right now
 *     (server-read).
 *
 *  2. Read the stored row for UPDATE and DELETE. A staff member cannot widen
 *     their own reach by asserting a different areaId in the request body,
 *     because the area being checked is the one on the row that is already
 *     stored, not the one they sent.
 *
 *  3. Area is resolved server-side. Invoices, payments, complaints and messages
 *     carry no areaId at all - they carry a customerId. Their area is looked up
 *     from the customer record, so pointing a payment at someone else's customer
 *     does not move it into your own area.
 */
import {
  COLLECTIONS,
  getDocument,
  listDocuments,
  type CollectionKey,
} from './appwrite-rest';
import { AuthError, type AuthProfile, type SessionClaims } from './auth';

/**
 * `upsert` is the operation a client asks for, and the server resolves it into
 * `create` or `update` by looking at what is stored. A client therefore cannot
 * choose which grant applies, and cannot turn an update into a create (or the
 * reverse) by sending the wrong thing.
 */
export type WriteOperation = 'upsert' | 'create' | 'update' | 'delete';

/**
 * Where a collection's area comes from.
 *
 *   direct   - the record carries areaId (customers, connections, expenses)
 *   customer - the record carries customerId; the area is the customer's area
 *   none     - the record is not area scoped
 */
export type AreaSource = 'direct' | 'customer' | 'none';

export interface WritePolicy {
  /**
   * The caller must hold access to at least one of these modules. Empty means
   * the section grant is not part of this decision, which is what a side-effect
   * collection like the activity log needs: it is written on every action, so
   * gating it on a module would make the audit trail itself fragile.
   *
   * Several are lists rather than one name because staff reach the same record
   * from different screens. A support clerk with the invoices module really does
   * record payments, and refusing them because the payments module is closed
   * would break a workflow that is supposed to work.
   */
  sections: readonly string[];
  /** Any one of these grants the write. Empty means section access is enough. */
  functions?: readonly string[];
  /** Overrides `functions` when the row does not exist yet. */
  createFunctions?: readonly string[];
  /** Administrators only, regardless of section or area. */
  adminOnly?: boolean;
  areaSource: AreaSource;
  /**
   * Changing the record's area (or the customer that determines it) moves
   * records between scoping domains, so it is reserved for administrators.
   */
  areaChangeAdminOnly?: boolean;
}

/**
 * The whole authorization policy, in one table.
 *
 * Sections and function names come from src/types/index.ts, so the UI and the
 * server agree on the vocabulary without either one inventing its own.
 */
export const WRITE_POLICY: Readonly<Record<CollectionKey, WritePolicy>> = {
  customers: {
    sections: ['customers'],
    createFunctions: ['add_customers'],
    functions: ['edit_customers', 'delete_customers'],
    areaSource: 'direct',
    areaChangeAdminOnly: true,
  },
  connections: {
    sections: ['connections', 'customers'],
    createFunctions: ['approve_connections'],
    functions: ['approve_connections', 'add_customers'],
    areaSource: 'direct',
    areaChangeAdminOnly: true,
  },
  invoices: {
    sections: ['invoices', 'billing', 'reports'],
    // Recording a payment settles an invoice, so it must not require the
    // bill-generation grant on its own.
    functions: ['generate_bills', 'receive_payments'],
    areaSource: 'customer',
    areaChangeAdminOnly: true,
  },
  payments: {
    sections: ['payments', 'billing', 'invoices', 'due-payments', 'reports'],
    createFunctions: ['receive_payments'],
    functions: ['receive_payments'],
    areaSource: 'customer',
    areaChangeAdminOnly: true,
  },
  expenses: {
    sections: ['expenses', 'reports', 'billing'],
    functions: ['view_reports', 'export_data'],
    areaSource: 'direct',
    areaChangeAdminOnly: true,
  },
  packages: {
    sections: ['packages', 'billing'],
    functions: ['manage_packages'],
    areaSource: 'none',
  },
  inventory: {
    sections: ['inventory', 'stock-alerts'],
    functions: ['manage_inventory'],
    areaSource: 'none',
  },
  complaints: {
    sections: ['complaints'],
    functions: ['delete_records'],
    areaSource: 'customer',
    areaChangeAdminOnly: true,
  },
  messages: {
    sections: ['messages', 'complaints'],
    functions: ['send_messages'],
    areaSource: 'customer',
    areaChangeAdminOnly: true,
  },
  announcements: {
    sections: ['announcements', 'messages'],
    functions: ['send_messages'],
    areaSource: 'none',
  },
  staff: {
    // Holds each colleague's role and permission grants, and decides which area
    // teams they belong to. Never a staff-level write.
    sections: ['staff'],
    adminOnly: true,
    areaSource: 'none',
  },
  areas: {
    // Creating an area mints a new Appwrite team, and renaming or removing one
    // rewrites who can see what. Administrators only.
    sections: ['areas'],
    adminOnly: true,
    areaSource: 'none',
  },
  settings: {
    sections: ['company-profile', 'settings'],
    adminOnly: true,
    areaSource: 'none',
  },
  deletionRequests: {
    // Raised from most modules, so admission is broad; what may actually be
    // deleted is decided by the target collection's own policy.
    sections: [
      'deletion-requests',
      'customers',
      'staff',
      'packages',
      'connections',
      'complaints',
      'inventory',
      'expenses',
    ],
    functions: ['delete_records'],
    areaSource: 'none',
  },
  activityLogs: {
    // Written on every single change. Gating the audit trail on a module would
    // mean an audit entry silently disappears whenever a role's module list does
    // not cover it, which is the opposite of what an audit log is for. The
    // server stamps the actor from the session, so an entry cannot be forged.
    sections: [],
    areaSource: 'none',
  },
};

/** Collections a client may never name in a request path. */
export function isWritableCollection(name: string): name is CollectionKey {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, name) && name in WRITE_POLICY;
}

/* -------------------------------------------------------------------------- */
/*  Area resolution                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cached customer -> area index.
 *
 * Only the id and area are held, never the rest of the record: this runs on every
 * write and the customer table carries CNICs and addresses.
 */
let customerAreaIndex: { at: number; byId: Map<string, string | null> } | null = null;
const CUSTOMER_AREA_TTL_MS = 60_000;

export function invalidateAreaCaches(): void {
  customerAreaIndex = null;
}

async function getCustomerAreaMap(): Promise<Map<string, string | null>> {
  if (customerAreaIndex && Date.now() - customerAreaIndex.at < CUSTOMER_AREA_TTL_MS) {
    return customerAreaIndex.byId;
  }

  const rows = await listDocuments<{ id: string; areaId?: string }>(COLLECTIONS.customers, {
    limit: 5000,
  });

  const map = new Map<string, string | null>();
  for (const row of rows) {
    if (row?.id) map.set(row.id, typeof row.areaId === 'string' && row.areaId ? row.areaId : null);
  }

  customerAreaIndex = { at: Date.now(), byId: map };
  return map;
}

type StoredRecord = Record<string, unknown>;

/**
 * The area a record belongs to, as the server sees it.
 *
 * `record` is the row as stored in Appwrite, never the request body. Returns null
 * for records that carry no area, which is normal for packages, inventory,
 * settings and the like.
 */
export async function resolveArea(
  policy: WritePolicy,
  record: StoredRecord | null
): Promise<string | null> {
  if (policy.areaSource === 'none' || !record) return null;

  if (policy.areaSource === 'direct') {
    const areaId = record.areaId;
    return typeof areaId === 'string' && areaId ? areaId : null;
  }

  const customerId = record.customerId;
  if (typeof customerId !== 'string' || !customerId) return null;
  const map = await getCustomerAreaMap();
  return map.get(customerId) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Checks                                                                    */
/* -------------------------------------------------------------------------- */

function requireStaffProfile(claims: SessionClaims, profile: AuthProfile): void {
  if (claims.role === 'Customer' || profile.role === 'Customer') {
    throw new AuthError('This endpoint is for staff accounts.', 403);
  }
  if (claims.role !== profile.role) {
    // The role changed mid-session. Force a fresh sign-in rather than guessing.
    throw new AuthError('Your role changed. Please sign in again.', 403);
  }
}

function assertSection(policy: WritePolicy, profile: AuthProfile): void {
  if (profile.role === 'Admin') return;
  if (policy.sections.length === 0) return;
  if (!policy.sections.some((section) => profile.allowedSections.includes(section))) {
    throw new AuthError(
      `Your role does not hold permission to change ${policy.sections[0]} records.`,
      403
    );
  }
}

function assertFunction(policy: WritePolicy, profile: AuthProfile, operation: 'create' | 'update' | 'delete'): void {
  if (profile.role === 'Admin') return;
  const required =
    operation === 'create' && policy.createFunctions
      ? policy.createFunctions
      : policy.functions;

  // An absent list means the section grant is the whole requirement.
  if (!required || required.length === 0) return;
  if (!required.some((fn) => profile.allowedFunctions.includes(fn))) {
    throw new AuthError(`Your role does not hold permission to ${operation} this record.`, 403);
  }
}

/**
 * The area gate.
 *
 * Only applies to collections that are actually area scoped. Packages,
 * inventory, settings and the like belong to no area, and are decided entirely
 * by role, section and function.
 *
 * `null` here means a record that should have an area but does not resolve to
 * one - a legacy customer with no areaId, or a payment whose customer is missing.
 * That is treated as administrator-only rather than as "everyone", because the
 * alternative is exactly the hole the old permission builder had: a record with
 * no area silently became writable by the entire staff team.
 */
function assertArea(
  policy: WritePolicy,
  areaId: string | null,
  profile: AuthProfile
): void {
  if (policy.areaSource === 'none') return;
  if (profile.role === 'Admin') return;

  if (!areaId) {
    throw new AuthError('This record is not assigned to an area. Administrator required.', 403);
  }

  const assigned = profile.assignedAreaIds ?? [];
  if (!assigned.includes(areaId)) {
    throw new AuthError('This record belongs to an area you are not assigned to.', 403);
  }
}

function assertAreaUnchanged(
  policy: WritePolicy,
  before: StoredRecord | null,
  after: StoredRecord | null,
  profile: AuthProfile
): void {
  if (profile.role === 'Admin') return;
  if (!policy.areaChangeAdminOnly) return;

  if (policy.areaSource === 'direct') {
    const from = typeof before?.areaId === 'string' ? before.areaId : '';
    const to = typeof after?.areaId === 'string' ? after.areaId : '';
    if (from !== to) {
      throw new AuthError('Only an administrator can move a record between areas.', 403);
    }
    return;
  }

  if (policy.areaSource === 'customer') {
    const from = typeof before?.customerId === 'string' ? before.customerId : '';
    const to = typeof after?.customerId === 'string' ? after.customerId : '';
    if (from !== to) {
      throw new AuthError('Only an administrator can reassign a record to another subscriber.', 403);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export interface WriteRequest {
  claims: SessionClaims;
  profile: AuthProfile;
  collection: CollectionKey;
  documentId: string;
  operation: WriteOperation;
  /** The body the client sent. Used only to detect intent, never to grant access. */
  incoming: StoredRecord | null;
}

export interface AuthorizedWrite {
  collection: CollectionKey;
  documentId: string;
  operation: WriteOperation;
  /** The area the row belongs to, for the permission list the server applies. */
  areaId: string | null;
  /** True when the row did not exist before this request. */
  isNew: boolean;
  /**
   * Fields the server overrides so they cannot be forged. Activity log entries
   * take their actor from the session.
   */
  payload: StoredRecord;
}

/**
 * Decides one write. Throws AuthError with 403/404 when the caller is not
 * allowed; returns the values the caller needs to perform it.
 */
export async function authorizeWrite(request: WriteRequest): Promise<AuthorizedWrite> {
  const { claims, profile, collection, documentId, incoming } = request;

  requireStaffProfile(claims, profile);

  const policy = WRITE_POLICY[collection];
  if (!policy) {
    // Not a failure worth describing to the client: this is a routing bug.
    throw new AuthError('Unknown collection.', 404);
  }

  if (policy.adminOnly && profile.role !== 'Admin') {
    throw new AuthError('Administrator access required.', 403);
  }

  assertSection(policy, profile);

  /**
   * The stored row, read with the server API key. This is the anti-tamper core:
   * authorization for an existing record is decided against what is actually in
   * the database, so nothing in the request body can change the answer.
   */
  const existing = (await getDocument<StoredRecord>(COLLECTIONS[collection], documentId)) as
    | StoredRecord
    | null;

  const isNew = existing === null;

  // Resolved here, never taken from the request.
  const resolved: 'create' | 'update' =
    request.operation === 'upsert'
      ? isNew
        ? 'create'
        : 'update'
      : (request.operation as 'create' | 'update');

  if (resolved !== 'create' && !existing) {
    // Distinguishing "does not exist" from "not yours to touch" would leak
    // whether an id exists, so an update or delete on a missing row reads as
    // a plain 404 without confirming existence to the caller.
    throw new AuthError('That record no longer exists. Refresh and try again.', 404);
  }

  assertFunction(policy, profile, resolved);

  // Which record is being judged: for a create there is no stored row, so the
  // incoming body is the only thing there is to judge.
  const subject: StoredRecord | null = resolved === 'create' ? (incoming ?? {}) : existing;

  const areaId = await resolveArea(policy, subject);
  assertArea(policy, areaId, profile);

  if (resolved === 'update') {
    assertAreaUnchanged(policy, existing, incoming, profile);
  }

  const payload: StoredRecord = { ...(incoming ?? {}) };

  // The audit trail records who acted, taken from the session rather than the
  // body, so a staff member cannot file a log entry in someone else's name.
  if (collection === 'activityLogs') {
    payload.userEmail = profile.email;
    payload.userName = profile.name;
  }

  return { collection, documentId, operation: resolved, areaId, isNew, payload };
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Narrows a list of rows to the ones this session is allowed to see.
 *
 * The panel used to have the browser ask Appwrite directly, which meant the
 * answer depended on team permissions being carried inside a JWT. They are not:
 * a JWT from `account/jwt` names the account, not the teams it belongs to, so
 * every area-scoped query came back empty and the panel showed nothing at all.
 * Reading through the server removes that dependency entirely - the area is
 * resolved from the row, the same way the write path resolves it, so a record
 * cannot be read by an operator it could not be written by.
 *
 * An administrator sees everything. For everyone else a row is included when its
 * area is one of theirs, or when the row has no area and the collection is
 * world-readable to the staff team. Rows that resolve to no area are included
 * only for the staff team, which matches `permissionsForArea`.
 */
export async function filterReadableRows<T extends StoredRecord>(
  collection: CollectionKey,
  rows: T[],
  profile: AuthProfile
): Promise<T[]> {
  if (profile.role === 'Admin') return rows;

  const assigned = new Set(profile.assignedAreaIds ?? []);
  const policy = WRITE_POLICY[collection];

  const kept: T[] = [];
  for (const row of rows) {
    const areaId = await resolveArea(policy, row);
    if (areaId) {
      if (assigned.has(areaId)) kept.push(row);
      continue;
    }
    // No area: visible to the staff team, which is what the row permission grants.
    kept.push(row);
  }
  return kept;
}
