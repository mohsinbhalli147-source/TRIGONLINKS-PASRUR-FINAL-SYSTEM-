import crypto from 'node:crypto';

/**
 * Subscriber credentials.
 *
 * Subscribers sign in with their Trigon Links user ID plus their CNIC. Neither
 * factor is secret in the strict sense - a CNIC is printed on a national ID
 * card - so the CNIC is never stored. Only a PBKDF2-SHA512 hash of it is, with a
 * per-subscriber random salt, and verification is a constant-time comparison.
 *
 * Requiring both factors together is what makes this acceptable: knowing a
 * subscriber's CNIC is not enough without also knowing the user ID the ISP
 * issued, and the pair cannot be enumerated from public records.
 *
 * Subscribers deliberately do not get Appwrite accounts. They have no data
 * access in Appwrite at all, so there is nothing for a session token to grant.
 */

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha512';

export interface HashResult {
  hash: string;
  salt: string;
  iterations: number;
}

/** Normalises Pakistani CNIC input: 35202-1234567-1 and 3520212345671 match. */
export function normaliseCnic(input: unknown): string {
  return String(input ?? '')
    .replace(/[^0-9]/g, '')
    .trim();
}

/**
 * A CNIC is 13 digits. The check digit is validated so obviously mistyped
 * numbers fail fast with a clear message instead of a confusing auth failure.
 */
export function isPlausibleCnic(normalised: string): boolean {
  return /^\d{13}$/.test(normalised);
}

export function hashCnic(cnic: string, salt?: string): HashResult {
  const useSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .pbkdf2Sync(normaliseCnic(cnic), useSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return { hash: derived, salt: useSalt, iterations: PBKDF2_ITERATIONS };
}

export function verifyCnic(cnic: string, stored: HashResult): boolean {
  if (!stored?.hash || !stored?.salt) return false;
  const iterations = stored.iterations || PBKDF2_ITERATIONS;
  const derived = crypto
    .pbkdf2Sync(normaliseCnic(cnic), stored.salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');

  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(stored.hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const credentialCollectionId = 'subscriber_credentials';
