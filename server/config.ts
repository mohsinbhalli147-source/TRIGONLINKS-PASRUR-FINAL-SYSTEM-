import dotenv from 'dotenv';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

export const isProduction = process.env.NODE_ENV === 'production';

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. ${hint}\n` +
        `Copy .env.example to .env.local and fill it in. Refusing to start with a default value.`
    );
  }
  return value.trim();
}

/**
 * Every secret is required and has NO hardcoded fallback. A committed key is
 * indistinguishable from a rotated one, so we fail fast instead of guessing.
 */
function requireSecret(name: string, minLength: number, hint: string): string {
  const value = required(name, hint);
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters.`);
  }
  return value;
}

function isValidSessionSecret(value: string): boolean {
  if (isProduction) return value.length >= 32;
  return value.length >= 16;
}

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  appwrite: {
    endpoint: optional('APPWRITE_ENDPOINT', 'https://sgp.cloud.appwrite.io/v1'),
    // The project ID is an identifier, not a credential, so a default is safe.
    projectId: optional('APPWRITE_PROJECT_ID', ''),
    databaseId: optional('APPWRITE_DATABASE_ID', ''),
    apiKey: requireSecret('APPWRITE_API_KEY', 16, 'Create a server API key in the Appwrite console.'),
  },

  session: {
    secret: requireSecret('SESSION_SECRET', isProduction ? 32 : 16, 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'),
    cookieName: optional('SESSION_COOKIE_NAME', 'trigon_session'),
    ttlHours: Number(optional('SESSION_TTL_HOURS', '8')),
  },

  // First-run admin bootstrap. No defaults: an app must never ship with a
  // password anyone can guess.
  bootstrap: {
    adminEmail: optional('ADMIN_EMAIL', ''),
    adminPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
    adminName: optional('ADMIN_NAME', 'Super Admin'),
  },

  security: {
    frameOptions: optional('X_FRAME_OPTIONS', 'SAMEORIGIN'),
    trustProxy: optional('TRUST_PROXY', 'false') === 'true',
  },

  /**
   * Development escape hatch: let a subscriber sign in with a CNIC that has no
   * PBKDF2 hash stored yet. Off by default and rejected in production, because
   * it would mean verifying a factor that was never hashed.
   */
  allowUnhashedSubscriberFallback:
    optional('ALLOW_UNHASHED_SUBSCRIBER_FALLBACK', 'false') === 'true' && !isProduction,
};

export type AppConfig = typeof config;
export default config;

export function assertConfigValid(): void {
  if (!config.appwrite.projectId) {
    throw new Error('APPWRITE_PROJECT_ID is required. Found in the Appwrite console project settings.');
  }
  if (!config.appwrite.databaseId) {
    throw new Error('APPWRITE_DATABASE_ID is required. Set it after running the provisioning script.');
  }
  if (!isValidSessionSecret(config.session.secret)) {
    throw new Error(`SESSION_SECRET is too short for ${config.nodeEnv}. Use at least 32 random characters.`);
  }
  if (config.allowUnhashedSubscriberFallback && isProduction) {
    throw new Error(
      'ALLOW_UNHASHED_SUBSCRIBER_FALLBACK cannot be enabled in production.'
    );
  }
  if (
    config.bootstrap.adminPassword &&
    !config.bootstrap.adminEmail &&
    isProduction
  ) {
    throw new Error('ADMIN_INITIAL_PASSWORD requires ADMIN_EMAIL to be set as well.');
  }
}
