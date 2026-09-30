import React, { useState, useEffect } from 'react';
import {
  Building2,
  Save,
  Radio,
  CreditCard,
  Mail,
  CheckCircle,
  Smartphone,
  Check,
  RefreshCw,
  Users,
  HardDrive,
  Cloud,
  Download,
  ExternalLink,
  ShieldCheck,
  Clock,
  Database,
  FileJson,
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  signInWithGoogle,
  signOutGoogle,
  isGoogleConnected,
  getGoogleUser,
  syncAllCustomersToGoogle,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  restoreFromGoogleDriveBackup,
  GoogleDriveBackupItem,
} from '../../services/googleWorkspace';
import { SettingsConfig } from '../../types';

interface CompanyConfig {
  companyName: string;
  legalName: string;
  helpline: string;
  email: string;
  address: string;
  ntn: string;
  ptaLicense: string;
  bankName: string;
  bankTitle: string;
  bankIban: string;
  jazzCashAccount: string;
  easyPaisaAccount: string;
  receiptFooter: string;
}

export const CompanyProfileView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isSaved, setIsSaved] = useState(false);

  // Google Workspace Integration State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncResult, setBulkSyncResult] = useState<string | null>(null);

  // Google Drive Backup State
  const [isBackingUpDrive, setIsBackingUpDrive] = useState(false);
  const [driveBackups, setDriveBackups] = useState<GoogleDriveBackupItem[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isRestoringDrive, setIsRestoringDrive] = useState(false);
  const [restoringFileId, setRestoringFileId] = useState<string | null>(null);
  const [lastDriveBackupMsg, setLastDriveBackupMsg] = useState<string | null>(null);

  // Settings from Storage
  const [storageSettings, setStorageSettings] = useState<SettingsConfig>(() => StorageService.getSettings());
  const [adminEmail, setAdminEmail] = useState(
    storageSettings.adminNotificationEmail || 'mohsinbhalli147@gmail.com'
  );
  const [autoSaveContacts, setAutoSaveContacts] = useState(
    storageSettings.autoSaveGoogleContacts !== false
  );
  const [autoSendAlerts, setAutoSendAlerts] = useState(
    storageSettings.autoSendGmailAlerts !== false
  );
  const [googleDriveEmail, setGoogleDriveEmail] = useState(
    storageSettings.googleDriveEmail || storageSettings.adminNotificationEmail || 'mohsinbhalli147@gmail.com'
  );
  const [autoBackupDrive, setAutoBackupDrive] = useState(
    storageSettings.autoBackupToGoogleDrive !== false
  );
  const [backupIntervalHours, setBackupIntervalHours] = useState(
    storageSettings.googleDriveBackupIntervalHours || 24
  );

  const [config, setConfig] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('trigon_company_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      companyName: 'TRIGON LINKS BROADBAND',
      legalName: 'Trigon Links Communication Network (Pvt) Ltd.',
      helpline: '0300-8451122 / 0321-4992011',
      email: 'support@trigonlinks.pk',
      address: 'Main Optical Fiber NOC, Kutchery Road, Pasrur, Sialkot',
      ntn: '9845112-7',
      ptaLicense: 'DIR(C)/PTA/SZ/ISP-894/2022',
      bankName: 'Meezan Bank Limited',
      bankTitle: 'Trigon Links Broadband',
      bankIban: 'PK42MEZN0001000123456789',
      jazzCashAccount: '0300-8451122 (Mohsin Bhalli)',
      easyPaisaAccount: '0321-4992011 (Trigon Links)',
      receiptFooter: 'Thank you for choosing high-speed optical fiber internet. For billing & 24/7 NOC support call 0300-8451122.',
    };
  });

  const loadDriveBackups = async () => {
    if (!isGoogleConnected()) return;
    setIsLoadingBackups(true);
    try {
      const list = await listGoogleDriveBackups();
      setDriveBackups(list);
    } catch (err) {
      console.warn('Could not load drive backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    const handleGoogleAuth = () => {
      const connected = isGoogleConnected();
      setGoogleConnected(connected);
      const gUser = getGoogleUser();
      if (gUser?.email) {
        setGoogleUserEmail(gUser.email);
      }
      if (connected) {
        loadDriveBackups();
      }
    };

    handleGoogleAuth();
    window.addEventListener('trigon_google_auth_changed', handleGoogleAuth);
    return () => window.removeEventListener('trigon_google_auth_changed', handleGoogleAuth);
  }, []);

  const handleChange = (field: keyof CompanyConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('trigon_company_profile', JSON.stringify(config));

    // Update settings in storage
    const updatedSettings: SettingsConfig = {
      ...storageSettings,
      adminNotificationEmail: adminEmail.trim(),
      autoSaveGoogleContacts: autoSaveContacts,
      autoSendGmailAlerts: autoSendAlerts,
      googleDriveEmail: googleDriveEmail.trim(),
      autoBackupToGoogleDrive: autoBackupDrive,
      googleDriveBackupIntervalHours: Number(backupIntervalHours),
    };
    StorageService.saveSettings(updatedSettings, user?.email || 'admin@trigonlinks.pk');
    setStorageSettings(updatedSettings);

    StorageService.logActivity(
      user?.email || 'admin@trigonlinks.pk',
      user?.name || 'Admin',
      'Updated Company Profile & Google Settings',
      'company-profile',
      `Updated ISP settings for "${config.companyName}", Google Contacts: ${adminEmail}, Drive: ${googleDriveEmail}`
    );
    showToast('success', 'Profile Updated', 'Company branding, Google Contacts and Google Drive settings saved successfully.');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleConnectGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res) {
        setGoogleConnected(true);
        setGoogleUserEmail(res.user.email || '');
        showToast(
          'success',
          'Google Account Connected!',
          `Connected to ${res.user.email}. Google Contacts auto-sync and Google Drive backups are now active.`
        );
        loadDriveBackups();
      }
    } catch (err: any) {
      showToast('error', 'Google Connection Failed', err?.message || 'Could not authenticate with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await signOutGoogle();
    setGoogleConnected(false);
    setGoogleUserEmail('');
    setDriveBackups([]);
    showToast('info', 'Google Account Disconnected', 'Auto-sync to Google Contacts and Google Drive paused.');
  };

  const handleBulkSyncContacts = async () => {
    if (!googleConnected) {
      showToast('error', 'Google Account Required', 'Please connect your Google Account first.');
      return;
    }

    const customers = StorageService.getCustomers();
    if (customers.length === 0) {
      showToast('info', 'No Customers', 'No customer records available to sync.');
      return;
    }

    setIsBulkSyncing(true);
    setBulkSyncResult(null);
    try {
      const res = await syncAllCustomersToGoogle(customers);
      setBulkSyncResult(`Successfully synced ${res.successful} / ${res.total} customer contacts to Google Contacts.`);
      showToast(
        'success',
        'Contacts Synced!',
        `${res.successful} customer contacts added with Username & Mobile. Incoming calls will now identify customer caller ID!`
      );
    } catch (err: any) {
      showToast('error', 'Sync Failed', err?.message || 'Error occurred while syncing contacts.');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Google Drive Instant Backup
  const handleBackupToDriveNow = async () => {
    if (!googleConnected) {
      showToast('error', 'Google Account Required', 'Please connect your Google Account first.');
      return;
    }

    setIsBackingUpDrive(true);
    setLastDriveBackupMsg(null);
    try {
      const res = await uploadBackupToGoogleDrive();
      if (res.success) {
        setLastDriveBackupMsg(res.message);
        showToast('success', 'Google Drive Backup Complete!', res.message);
        loadDriveBackups();
        setStorageSettings(StorageService.getSettings());
      } else {
        showToast('error', 'Backup Failed', res.message);
      }
    } catch (err: any) {
      showToast('error', 'Backup Failed', err?.message || 'Error occurred while uploading backup.');
    } finally {
      setIsBackingUpDrive(false);
    }
  };

  // Google Drive Restore
  const handleRestoreFromDrive = async (file: GoogleDriveBackupItem) => {
    if (
      !window.confirm(
        `Are you sure you want to restore database from Google Drive backup "${file.name}"?\nThis will update your local ISP data.`
      )
    ) {
      return;
    }

    setIsRestoringDrive(true);
    setRestoringFileId(file.id);
    try {
      const res = await restoreFromGoogleDriveBackup(file.id);
      if (res.success) {
        showToast('success', 'Database Restored!', res.message);
      } else {
        showToast('error', 'Restore Failed', res.message);
      }
    } catch (err: any) {
      showToast('error', 'Restore Failed', err?.message || 'Error restoring from Google Drive.');
    } finally {
      setIsRestoringDrive(false);
      setRestoringFileId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            Company &amp; ISP Branding Profile
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Corporate credentials, Google Contacts caller ID auto-sync, Google Drive cloud backups, licensing &amp; bank accounts
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold text-xs">
            <CheckCircle className="w-4 h-4" /> Changes Saved
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl text-xs">
        {/* ========================================================================= */}
        {/* 1. GOOGLE DRIVE CLOUD AUTO-BACKUP INTEGRATION CARD */}
        {/* ========================================================================= */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-800/40 shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                Google Drive Cloud Auto-Backup Engine
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-800">
                  AUTO-BACKUP
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically saves full ISP database snapshots (Customers, Bills, Invoices, Payments, Inventory, Staff) to your Google Drive in folder <code className="text-indigo-300 font-mono">TrigonLinks_ISP_Cloud_Backups</code>.
              </p>
            </div>

            {/* Google Connection Status / Button */}
            <div>
              {googleConnected ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold text-xs">
                    <Check className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[160px]">{googleUserEmail || 'Drive Linked'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isGoogleLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isGoogleLoading ? 'Connecting Drive...' : 'Connect Google Drive'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="google-drive-backup-email" className="block text-slate-300 font-bold mb-1.5">
                Google Drive Dedicated Backup Email *
              </label>
              <div className="relative">
                <Cloud className="w-4 h-4 text-indigo-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="google-drive-backup-email"
                  type="email"
                  required
                  value={googleDriveEmail}
                  onChange={(e) => setGoogleDriveEmail(e.target.value)}
                  placeholder="mohsinbhalli147@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-400"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Database snapshots will be stored in this Google Drive account (can be same or separate from contacts).
              </p>
            </div>

            <div className="space-y-2.5" role="group" aria-labelledby="auto-backup-frequency-label">
              <label
                id="auto-backup-frequency-label"
                className="block text-slate-300 font-bold mb-1"
              >
                Auto-Backup Frequency
              </label>
              <div className="flex items-center gap-3">
                <label htmlFor="enable-auto-cloud-backup" className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex-1">
                  <input
                    type="checkbox"
                    checked={autoBackupDrive}
                    onChange={(e) => setAutoBackupDrive(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">Enable Auto Cloud Backup</span>
                    <span className="text-[10px] text-slate-400">Silent background sync to Google Drive</span>
                  </div>
                </label>

                <select
                   id="enable-auto-cloud-backup"
                  value={backupIntervalHours}
                  onChange={(e) => setBackupIntervalHours(Number(e.target.value))}
                  className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-indigo-400"
                >
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours</option>
                  <option value={24}>Daily (24 Hours)</option>
                  <option value={168}>Weekly</option>
                </select>
              </div>

              {storageSettings.lastGoogleDriveBackupTimestamp && (
                <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Last Drive Backup:{' '}
                  {new Date(storageSettings.lastGoogleDriveBackupTimestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons: 1-Click Backup Now */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Instant Cloud Snapshot to Google Drive
              </span>
              <p className="text-[11px] text-slate-400">
                Pushes a full timestamped JSON backup file to your Google Drive right now.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBackupToDriveNow}
              disabled={isBackingUpDrive}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBackingUpDrive ? 'animate-spin' : ''}`} />
              <span>{isBackingUpDrive ? 'Uploading to Drive...' : 'Backup Database to Google Drive Now'}</span>
            </button>
          </div>

          {lastDriveBackupMsg && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>{lastDriveBackupMsg}</span>
            </div>
          )}

          {/* Google Drive Existing Backups Table */}
          {googleConnected && (
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                  Available Backups on Google Drive ({driveBackups.length})
                </span>
                <button
                  type="button"
                  onClick={loadDriveBackups}
                  disabled={isLoadingBackups}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBackups ? 'animate-spin' : ''}`} /> Refresh List
                </button>
              </div>

              {driveBackups.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {driveBackups.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="truncate">
                        <span className="font-bold text-white block truncate">{b.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {b.size ? `${Math.round(b.size / 1024)} KB` : 'JSON'} &bull;{' '}
                          {b.createdTime ? new Date(b.createdTime).toLocaleString() : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {b.webViewLink && (
                          <a
                            href={b.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="View in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRestoreFromDrive(b)}
                          disabled={isRestoringDrive}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold text-[11px] transition-colors"
                        >
                          {isRestoringDrive && restoringFileId === b.id ? 'Restoring...' : 'Restore from Backup'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  {isLoadingBackups ? 'Checking Google Drive...' : 'No backup snapshots found in Google Drive yet. Click "Backup Database to Google Drive Now" to create your first cloud snapshot.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 2. GOOGLE CONTACTS & CALLER ID AUTO-SYNC INTEGRATION CARD */}
        {/* ========================================================================= */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border border-cyan-800/40 shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Google Contacts &amp; Caller ID Auto-Sync
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  AUTO-CALLER-ID
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically saves every new customer's mobile number &amp; <strong>Username</strong> directly to your Google Account. When a subscriber calls you, your mobile screen will instantly display their <strong>Username &amp; Name</strong>!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="admin-google-account-email" className="block text-slate-300 font-bold mb-1.5">
                Admin Google Account Email (For Contact Sync &amp; Alerts) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="admin-google-account-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="mohsinbhalli147@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Customer phone numbers &amp; usernames will be synced to this email address's Google Contacts.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="block text-slate-300 font-bold mb-1">Auto-Sync Rules</label>
              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={autoSaveContacts}
                  onChange={(e) => setAutoSaveContacts(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-200 block text-xs">
                    Auto-Save to Google Contacts on Customer Creation
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Saves contact name as <code className="text-cyan-300 font-mono">Name (username)</code> with phone number.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={autoSendAlerts}
                  onChange={(e) => setAutoSendAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-200 block text-xs">
                    Send Customer Details Email to Admin Email
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Sends full customer profile, package, area, and IP details to your email inbox.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 1-Click Sync All Customers Button */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Sync All Existing Customers ({StorageService.getCustomers().length} records)
              </span>
              <p className="text-[11px] text-slate-400">
                Push all existing customers to your Google Contacts right now so caller ID works for all previous subscribers.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBulkSyncContacts}
              disabled={isBulkSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black transition-all shadow-md shadow-cyan-950/30 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBulkSyncing ? 'animate-spin' : ''}`} />
              <span>{isBulkSyncing ? 'Syncing to Google...' : 'Sync All Customers to Google Contacts'}</span>
            </button>
          </div>

          {bulkSyncResult && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{bulkSyncResult}</span>
            </div>
          )}
        </div>

        {/* Basic Brand Info */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <Radio className="w-4 h-4 text-cyan-400" /> ISP Brand Particulars
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="trade-brand-name" className="block text-slate-300 font-bold mb-1.5">Trade / Brand Name *</label>
              <input
                 id="trade-brand-name"
                type="text"
                required
                value={config.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="registered-corporate-name" className="block text-slate-300 font-bold mb-1.5">Registered Corporate Name</label>
              <input
                 id="registered-corporate-name"
                type="text"
                value={config.legalName}
                onChange={(e) => handleChange('legalName', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="support-uan-helpline" className="block text-slate-300 font-bold mb-1.5">Support UAN / Helpline *</label>
              <input
                 id="support-uan-helpline"
                type="text"
                required
                value={config.helpline}
                onChange={(e) => handleChange('helpline', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="support-email" className="block text-slate-300 font-bold mb-1.5">Support Email *</label>
              <input
                 id="support-email"
                type="email"
                required
                value={config.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="fbr-ntn-strn" className="block text-slate-300 font-bold mb-1.5">FBR NTN / STRN</label>
              <input
                 id="fbr-ntn-strn"
                type="text"
                value={config.ntn}
                onChange={(e) => handleChange('ntn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pta-isp-operator-license-no" className="block text-slate-300 font-bold mb-1.5">PTA ISP Operator License No.</label>
            <input
               id="pta-isp-operator-license-no"
              type="text"
              value={config.ptaLicense}
              onChange={(e) => handleChange('ptaLicense', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label htmlFor="headquarters-noc-address" className="block text-slate-300 font-bold mb-1.5">Headquarters &amp; NOC Address</label>
            <input
               id="headquarters-noc-address"
              type="text"
              value={config.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Payment & Bank Collection Accounts */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
            <CreditCard className="w-4 h-4 text-emerald-400" /> Invoice Payment &amp; Bank Accounts (Printed on Invoices)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="jazzcash-merchant-mobile-account" className="block text-slate-300 font-bold mb-1.5">JazzCash Merchant / Mobile Account</label>
              <input
                 id="jazzcash-merchant-mobile-account"
                type="text"
                value={config.jazzCashAccount}
                onChange={(e) => handleChange('jazzCashAccount', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="easypaisa-account" className="block text-slate-300 font-bold mb-1.5">EasyPaisa Account</label>
              <input
                 id="easypaisa-account"
                type="text"
                value={config.easyPaisaAccount}
                onChange={(e) => handleChange('easyPaisaAccount', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="bank-name" className="block text-slate-300 font-bold mb-1.5">Bank Name</label>
              <input
                 id="bank-name"
                type="text"
                value={config.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="account-title" className="block text-slate-300 font-bold mb-1.5">Account Title</label>
              <input
                 id="account-title"
                type="text"
                value={config.bankTitle}
                onChange={(e) => handleChange('bankTitle', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="bank-iban-account-number" className="block text-slate-300 font-bold mb-1.5">Bank IBAN / Account Number</label>
              <input
                 id="bank-iban-account-number"
                type="text"
                value={config.bankIban}
                onChange={(e) => handleChange('bankIban', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="thermal-receipt-invoice-footer-notice" className="block text-slate-300 font-bold mb-1.5">Thermal Receipt / Invoice Footer Notice</label>
            <textarea
               id="thermal-receipt-invoice-footer-notice"
              rows={2}
              value={config.receiptFooter}
              onChange={(e) => handleChange('receiptFooter', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-xl shadow-cyan-950/50 transition-transform active:scale-95"
          >
            <Save className="w-4 h-4" />
            Save All Settings
          </button>
        </div>
      </form>
    </div>
  );
};
