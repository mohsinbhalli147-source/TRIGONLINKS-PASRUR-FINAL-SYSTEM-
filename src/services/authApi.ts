/**
 * Client for the server's authentication API.
 *
 * The browser never holds a password, and never decides what role it is. It
 * receives a real, revocable Appwrite session token plus a profile that the
 * server derived from that session. The httpOnly session cookie is what makes
 * the token obtainable again after a reload.
 */

export type AppRole = 'Admin' | 'Staff' | 'Customer';

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

export interface AppwriteSessionGrant {
  token: string;
  secret: string;
  sessionId: string;
  expiresAt: string;
}

export interface AppwriteConnection {
  endpoint: string;
  projectId: string;
  databaseId: string;
}

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
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  if (!response.ok) throw await readError(response, 'Request failed.');
  return (await response.json()) as T;
}

export async function fetchAppwriteConfig(): Promise<AppwriteConnection> {
  const response = await fetch('/api/config', { credentials: 'same-origin' });
  if (!response.ok) throw await readError(response, 'Server configuration unavailable.');
  const body = (await response.json()) as { appwrite: AppwriteConnection };
  return body.appwrite;
}

export async function fetchProvisioningStatus(): Promise<{ provisioned: boolean; message?: string }> {
  const response = await fetch('/api/auth/status', { credentials: 'same-origin' });
  if (response.ok) return (await response.json()) as { provisioned: boolean };
  const error = await readError(response, 'Could not verify the data service.');
  return { provisioned: false, message: error.message };
}

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<{ appwrite: AppwriteSessionGrant; profile: AuthProfile }> {
  return post('/api/auth/login', {
    identifier: input.identifier,
    password: input.password,
  });
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout');
}

/**
 * Restores the profile from the httpOnly cookie after a reload.
 *
 * Returns the Appwrite grant alongside the profile, since the browser has no
 * stored copy of the session. Appwrite is null for a subscriber session.
 *
 * The server always issues a new JWT here: the one from sign-in will have
 * expired while the tab was shut.
 */
export async function fetchSessionProfile(): Promise<{
  profile: AuthProfile;
  appwrite: AppwriteSessionGrant | null;
} | null> {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
  if (response.status === 401) return null;
  if (!response.ok) throw await readError(response, 'Could not verify the session.');
  return (await response.json()) as { profile: AuthProfile; appwrite: AppwriteSessionGrant | null };
}

/**
 * Trades the server-held session for a fresh 15 minute Appwrite JWT.
 *
 * Appwrite 2.x tokens are deliberately short lived, so the panel asks for a new
 * one before it lapses rather than signing the user out. No password is sent:
 * the httpOnly grant cookie is the credential.
 */
export async function refreshAppwriteToken(): Promise<AppwriteSessionGrant | null> {
  const response = await post<{ appwrite: AppwriteSessionGrant | null }>('/api/auth/refresh');
  return response.appwrite;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await post('/api/auth/change-password', input);
}

/**
 * Administrator only.
 *
 * Omit newPassword to have the server generate a strong one. The returned
 * password is shown once and is never stored anywhere in the browser.
 */
export async function resetAccountPassword(input: {
  entityId: string;
  newPassword?: string;
}): Promise<{ password: string; email: string; generated: boolean }> {
  return post('/api/admin/reset-password', {
    entityId: input.entityId,
    ...(input.newPassword ? { newPassword: input.newPassword } : {}),
  });
}
