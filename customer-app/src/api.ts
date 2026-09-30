/**
 * Client for the Trigon Links subscriber API.
 *
 * There is no Appwrite SDK here and no session token in the browser. Subscribers
 * authenticate against the server, which keeps an httpOnly cookie and serves
 * every read from /api/portal scoped to that one subscriber. Nothing about the
 * subscriber base is reachable from this app.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export class ApiError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readError(response: Response, fallback: string): Promise<ApiError> {
  let message = fallback;
  try {
    const body = (await response.json()) as { message?: string };
    if (body?.message) message = body.message;
  } catch {
    /* keep the fallback */
  }
  return new ApiError(message, response.status);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Sends the httpOnly session cookie.
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach Trigon Links. Check your internet connection.', 0);
  }
  if (!response.ok) throw await readError(response, 'Request failed.');
  return (await response.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  } catch {
    throw new ApiError('Cannot reach Trigon Links. Check your internet connection.', 0);
  }
  if (response.status === 401) throw new ApiError('Your session has expired.', 401);
  if (!response.ok) throw await readError(response, 'Request failed.');
  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/*  Session                                                                   */
/* -------------------------------------------------------------------------- */

export interface SubscriberProfile {
  uid: string;
  role: 'Customer';
  customerId: string;
  name: string;
  email: string;
}

export function signIn(input: { userId: string; cnic: string }): Promise<{ profile: SubscriberProfile }> {
  return post('/api/auth/subscriber-login', {
    userId: input.userId.trim(),
    cnic: input.cnic.trim(),
  });
}

export function signOut(): Promise<void> {
  return post('/api/auth/logout');
}

/** Restores the session after a reload, or null when signed out. */
export async function restoreSession(): Promise<SubscriberProfile | null> {
  const response = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  const body = (await response.json()) as { profile: SubscriberProfile };
  // Staff sessions also resolve here; they are not subscribers.
  if (!body?.profile || body.profile.role !== 'Customer') return null;
  return body.profile;
}

export function checkStatus(): Promise<{ provisioned: boolean; message?: string }> {
  return get('/api/auth/status');
}

/* -------------------------------------------------------------------------- */
/*  Subscriber data                                                           */
/* -------------------------------------------------------------------------- */

export interface PortalProfile {
  id: string;
  name: string;
  username: string;
  email?: string;
  mobile?: string;
  cnic?: string;
  address?: string;
  areaName?: string;
  packageName?: string;
  packageSpeed?: string;
  monthlyFee?: number;
  totalMonthly?: number;
  ipAddress?: string;
  gateway?: string;
  pppoeUsername?: string;
  pppoePassword?: string;
  connectionType?: string;
  status?: string;
  installDate?: string;
  billingDate?: number;
  hasIptv?: boolean;
  ipCharges?: number;
  iptvCharges?: number;
  discount?: number;
  discountMonthly?: number;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  month: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
}

export interface PortalPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  date: string;
  discount?: number;
}

export interface PortalComplaint {
  id: string;
  ticketNumber: string;
  subject: string;
  description?: string;
  priority: string;
  status: string;
  createdAt: string;
  assignedStaff?: string;
}

export interface PortalData {
  profile: PortalProfile;
  invoices: PortalInvoice[];
  payments: PortalPayment[];
  complaints: PortalComplaint[];
  connections: Array<Record<string, unknown>>;
}

export function fetchPortal(): Promise<PortalData> {
  return get<PortalData>('/api/portal');
}

export function lodgeComplaint(input: {
  subject: string;
  message: string;
  priority: string;
}): Promise<{ complaint: PortalComplaint }> {
  return post('/api/portal/complaints', input);
}
