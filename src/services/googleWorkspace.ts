import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Customer } from '../types';
import { StorageService } from './storage';

// Reuse existing app or initialize
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
/**
 * Scopes are deliberately minimal.
 *
 * `https://mail.google.com/` granted read access to the operator's entire
 * mailbox, and `gmail.compose` is unnecessary when the only use is
 * `messages/send`. The drive scope is limited to `drive.file` so the app can
 * only see files it created itself.
 */
provider.addScope('https://www.googleapis.com/auth/contacts');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

// Listen for auth state change
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthSuccess && cachedAccessToken) onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain access token from Google sign-in.');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;

    // Store connection status indicator in localStorage for UX continuity (not the token itself)
    localStorage.setItem('trigon_google_connected_email', result.user.email || '');
    window.dispatchEvent(new CustomEvent('trigon_google_auth_changed'));

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || '';

    // Handle normal user cancellation gracefully
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      message.includes('popup-closed-by-user') ||
      message.includes('cancelled-popup-request')
    ) {
      console.log('Google Sign-in popup closed by user.');
      return null;
    }

    if (code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by browser. Please enable popups for this site and try again.');
    }

    console.warn('Google Sign In Notice:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getGoogleUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

export const isGoogleConnected = (): boolean => {
  return !!cachedAccessToken || (!!auth.currentUser && !!localStorage.getItem('trigon_google_connected_email'));
};

export const signOutGoogle = async () => {
  try {
    await auth.signOut();
  } catch {}
  cachedAccessToken = null;
  cachedUser = null;
  localStorage.removeItem('trigon_google_connected_email');
  window.dispatchEvent(new CustomEvent('trigon_google_auth_changed'));
};

// ==========================================
// 1. GOOGLE CONTACTS & CALLER ID AUTO-SYNC
// ==========================================

export const saveCustomerToGoogleContacts = async (
  customer: Customer,
  customToken?: string
): Promise<{ success: boolean; message: string; contactId?: string }> => {
  const token = customToken || cachedAccessToken;
  if (!token) {
    return {
      success: false,
      message: 'Google Account is not connected. Connect Google Account in Settings to auto-sync contacts.',
    };
  }

  try {
    const contactPayload = {
      names: [
        {
          givenName: customer.name,
          familyName: `(${customer.username})`,
          displayName: `${customer.name} [${customer.username}]`,
        },
      ],
      phoneNumbers: [
        {
          value: customer.mobile,
          type: 'mobile',
        },
        ...(customer.alternateMobile
          ? [
              {
                value: customer.alternateMobile,
                type: 'home',
              },
            ]
          : []),
      ],
      emailAddresses: customer.email
        ? [
            {
              value: customer.email,
              type: 'work',
            },
          ]
        : [],
      organizations: [
        {
          name: 'Trigon Links ISP Subscriber',
          title: `${customer.packageName || 'Broadband'} (${customer.areaName || 'Sector'})`,
        },
      ],
      userDefined: [
        {
          key: 'Username',
          value: customer.username,
        },
        {
          key: 'IP_Address',
          value: customer.ipAddress || '',
        },
        {
          key: 'Area',
          value: customer.areaName || '',
        },
        {
          key: 'Billing_Day',
          value: String(customer.billingDate || 1),
        },
      ],
      biographies: [
        {
          value: `ISP Subscriber Username: ${customer.username}\nArea: ${customer.areaName}\nPackage: ${customer.packageName} (Rs. ${customer.totalMonthly}/mo)\nIP: ${customer.ipAddress || 'Dynamic'}\nDevice: ${customer.device || 'ONT'}\nBilling Day: ${customer.billingDate || 1}st of month.`,
          contentType: 'TEXT_PLAIN',
        },
      ],
    };

    const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Google People API returned status ${response.status}`);
    }

    const createdContact = await response.json();
    return {
      success: true,
      message: `Contact "${customer.name} (${customer.username})" saved to Google Contacts successfully. Incoming calls will show customer username & name!`,
      contactId: createdContact.resourceName,
    };
  } catch (err: any) {
    console.warn('Google Contacts Sync Error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to sync contact with Google Contacts.',
    };
  }
};

export const syncAllCustomersToGoogle = async (
  customers: Customer[]
): Promise<{ total: number; successful: number; failed: number; errors: string[] }> => {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Account is not connected. Please connect Google Account first.');
  }

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const cust of customers) {
    const res = await saveCustomerToGoogleContacts(cust, token);
    if (res.success) {
      successful++;
    } else {
      failed++;
      errors.push(`${cust.name}: ${res.message}`);
    }
  }

  return { total: customers.length, successful, failed, errors };
};

// ==========================================
// 2. GMAIL NOTIFICATIONS
// ==========================================

/**
 * Escapes text before it is interpolated into an HTML email.
 *
 * Customer records are operator-entered, so a name containing markup would
 * otherwise be rendered as HTML by the recipient's mail client.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Base64url for MIME, without the deprecated unescape() round-trip. */
function base64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const sendAdminCustomerEmail = async (
  adminEmail: string,
  customer: Customer,
  actionType: 'New Customer Added' | 'Customer Plan Updated' | 'Customer Reconnected' = 'New Customer Added'
): Promise<{ success: boolean; message: string }> => {
  const token = cachedAccessToken;
  if (!token) {
    return { success: false, message: 'Google Account not signed in for Gmail dispatch.' };
  }
  if (!adminEmail) {
    return { success: false, message: 'No notification address is configured.' };
  }

  try {
    const targetEmail = adminEmail;
    const subject = `[Trigon Links] ${actionType}: ${customer.name} (${customer.username})`;

    const name = escapeHtml(customer.name);
    const username = escapeHtml(customer.username);
    const mobile = escapeHtml(customer.mobile);
    const areaName = escapeHtml(customer.areaName);
    const packageName = escapeHtml(customer.packageName);
    const totalMonthly = escapeHtml(customer.totalMonthly);
    const ipAddress = escapeHtml(customer.ipAddress || 'DHCP Dynamic');
    const device = escapeHtml(customer.device || 'ONT');

    const emailContent = [
      `To: ${targetEmail}`,
      `Subject: =?utf-8?B?${base64UrlUtf8(subject)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      `<div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: auto; border: 1px solid #1e293b;">`,
      `  <div style="text-align: center; margin-bottom: 20px;">`,
      `    <h2 style="color: #06b6d4; margin: 0; font-size: 22px;">TRIGON LINKS ISP</h2>`,
      `    <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Subscriber Auto-Sync &amp; Caller ID Registration</p>`,
      `  </div>`,
      `  <div style="background-color: #1e293b; padding: 18px; border-radius: 8px; border: 1px solid #334155;">`,
      `    <h3 style="color: #38bdf8; margin-top: 0;">${escapeHtml(actionType)}</h3>`,
      `    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Customer Name:</td><td style="padding: 6px 0; font-weight: bold; color: #ffffff;">${name}</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Username (Caller ID):</td><td style="padding: 6px 0; font-weight: bold; color: #22d3ee;">${username}</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Mobile Number:</td><td style="padding: 6px 0; font-weight: bold; color: #34d399;"><a href="tel:${escapeHtml((customer.mobile || '').replace(/[^0-9]/g, ''))}" style="color: #34d399; text-decoration: none;">${mobile}</a></td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Area / Sector:</td><td style="padding: 6px 0; color: #ffffff;">${areaName}</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Internet Package:</td><td style="padding: 6px 0; color: #ffffff;">${packageName} (${escapeHtml(customer.packageSpeed || '')})</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Monthly Charges:</td><td style="padding: 6px 0; font-weight: bold; color: #f59e0b;">Rs. ${totalMonthly}</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Billing Date:</td><td style="padding: 6px 0; color: #ffffff;">${escapeHtml(customer.billingDate || 1)}st of every month</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Assigned IP:</td><td style="padding: 6px 0; font-family: monospace; color: #cbd5e1;">${ipAddress}</td></tr>`,
      `      <tr><td style="padding: 6px 0; color: #94a3b8;">Hardware/ONT:</td><td style="padding: 6px 0; color: #cbd5e1;">${device}</td></tr>`,
      `    </table>`,
      `  </div>`,
      `  <p style="font-size: 12px; color: #64748b; margin-top: 16px; text-align: center;">This contact and mobile number has been saved to your Google Contacts account for automated Caller ID recognition.</p>`,
      `</div>`,
    ].join('\r\n');

    const encodedEmail = base64UrlUtf8(emailContent);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gmail API error status ${response.status}`);
    }

    return {
      success: true,
      message: `Notification email dispatched to ${targetEmail} via Gmail.`,
    };
  } catch (err: any) {
    console.warn('Gmail Dispatch Error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to dispatch Gmail notification.',
    };
  }
};

// ==========================================
// 3. GOOGLE DRIVE BACKUP & RESTORE ENGINE
// ==========================================

export interface GoogleDriveBackupItem {
  id: string;
  name: string;
  size?: number;
  createdTime: string;
  webViewLink?: string;
  iconLink?: string;
}

const BACKUP_FOLDER_NAME = 'TrigonLinks_ISP_Cloud_Backups';

/**
 * Find or create dedicated backup folder on user's Google Drive
 */
export const getOrCreateGoogleDriveFolder = async (token: string): Promise<string> => {
  // Query for existing folder
  const query = encodeURIComponent(
    `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated Cloud Database Backups for Trigon Links ISP Suite',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Failed to create Google Drive folder for backups.');
  }

  const folder = await createRes.json();
  return folder.id;
};

/**
 * Upload Full Database Snapshot to Google Drive
 */
export const uploadBackupToGoogleDrive = async (
  customToken?: string
): Promise<{
  success: boolean;
  message: string;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  sizeKb?: number;
}> => {
  const token = customToken || cachedAccessToken;
  if (!token) {
    return {
      success: false,
      message: 'Google Account is not connected. Connect Google Drive in Settings first.',
    };
  }

  try {
    const folderId = await getOrCreateGoogleDriveFolder(token);
    const snapshot = StorageService.getFullDatabaseSnapshot();
    const jsonString = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const sizeKb = Math.round(blob.size / 1024);

    const now = new Date();
    const dateTag = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const fileName = `TrigonLinks_Backup_${dateTag}.json`;

    // Multipart upload payload
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
      description: `Automated Trigon Links ISP Database Snapshot: ${snapshot.summary.totalCustomers} Customers, ${snapshot.summary.totalInvoices} Invoices.`,
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' })
    );
    form.append('file', blob);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,createdTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Google Drive Upload error status ${uploadRes.status}`);
    }

    const fileData = await uploadRes.json();

    // Update settings timestamp
    const settings = StorageService.getSettings();
    settings.lastGoogleDriveBackupTimestamp = new Date().toISOString();
    StorageService.saveSettings(settings, 'admin@trigonlinks.pk');

    StorageService.logActivity(
      'admin@trigonlinks.pk',
      'Super Admin',
      'Google Drive Cloud Backup',
      'Google Drive',
      `Uploaded automated cloud database backup (${sizeKb} KB, ${snapshot.summary.totalCustomers} customers) to Google Drive folder "${BACKUP_FOLDER_NAME}".`
    );

    return {
      success: true,
      message: `Database backup uploaded to Google Drive successfully! (File: ${fileName}, Size: ${sizeKb} KB)`,
      fileId: fileData.id,
      fileName: fileData.name,
      webViewLink: fileData.webViewLink,
      sizeKb,
    };
  } catch (err: any) {
    console.error('Google Drive Backup Error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to upload backup to Google Drive.',
    };
  }
};

/**
 * List all backup files saved on Google Drive
 */
export const listGoogleDriveBackups = async (
  customToken?: string
): Promise<GoogleDriveBackupItem[]> => {
  const token = customToken || cachedAccessToken;
  if (!token) return [];

  try {
    const query = encodeURIComponent(
      `name contains 'TrigonLinks_Backup' and trashed = false`
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime,webViewLink,iconLink)&orderBy=createdTime desc&pageSize=20`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('Failed to list Google Drive backups:', err);
    return [];
  }
};

/**
 * Download and restore backup file from Google Drive
 */
export const restoreFromGoogleDriveBackup = async (
  fileId: string,
  customToken?: string
): Promise<{ success: boolean; message: string; count: number }> => {
  const token = customToken || cachedAccessToken;
  if (!token) {
    return {
      success: false,
      message: 'Google Account is not connected.',
      count: 0,
    };
  }

  try {
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!fileRes.ok) {
      throw new Error(`Failed to download file from Google Drive: HTTP ${fileRes.status}`);
    }

    const snapshot = await fileRes.json();
    const result = StorageService.restoreFullDatabaseSnapshot(snapshot);
    return result;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to restore backup from Google Drive.',
      count: 0,
    };
  }
};

/**
 * Scheduled backup on start-up has been removed deliberately.
 *
 * A full snapshot includes subscriber PII, and silently uploading it to a
 * consumer Google Drive account on every sign-in was a data-protection problem.
 * Backups are now an explicit administrator action from Company Profile, which
 * shows what will be uploaded before it happens.
 */
