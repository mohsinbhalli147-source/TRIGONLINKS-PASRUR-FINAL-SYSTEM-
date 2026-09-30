import { StorageService } from './storage';
import { AppwriteService } from './appwrite';

class AutoSyncServiceClass {
  private intervalId: number | null = null;
  private isSyncing = false;
  private lastSyncTime: Date | null = null;
  private isEnabled = true;
  private isPulling = false;
  private started = false;
  private teardown: Array<() => void> = [];

  constructor() {
    const pref = localStorage.getItem('trigon_autosync_enabled');
    if (pref !== null) {
      this.isEnabled = pref === 'true';
    }
  }

  public init() {
    if (typeof window === 'undefined' || this.started) return;
    this.started = true;

    // 1. Initial quick bi-directional sync
    const startTimer = window.setTimeout(() => {
      this.performSync(true);
    }, 800);

    // 2. Bi-directional sync loop.
    // 4 seconds was aggressive enough that a busy day meant tens of thousands
    // of write requests; writes are already pushed on change, so this only
    // needs to be a safety net for anything that failed to upload.
    this.intervalId = window.setInterval(() => {
      if (this.isEnabled && !document.hidden && !this.isSyncing) {
        this.performSync(true);
      }
    }, 60_000);

    // 3. Tab visibility & device wake listeners, with their teardown captured.
    const onVisibility = () => {
      if (!document.hidden && this.isEnabled) this.performSync(true);
    };
    const onFocus = () => {
      if (this.isEnabled) this.performSync(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    this.teardown = [
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => window.removeEventListener('focus', onFocus),
    ];
  }

  /** Stops the loop and removes every listener. Called on sign-out. */
  public stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    for (const off of this.teardown) off();
    this.teardown = [];
  }

  public getStatus() {
    return {
      isSyncing: this.isSyncing || this.isPulling,
      lastSyncTime: this.lastSyncTime,
      isEnabled: this.isEnabled,
    };
  }

  // Fast background pull from Cloud to keep device updated in real-time
  public async performPull(silent: boolean = false): Promise<boolean> {
    if (this.isPulling || !this.isEnabled) return false;
    this.isPulling = true;

    try {
      const res = await StorageService.pullAllFromAppwrite();
      this.lastSyncTime = new Date();
      return res.success;
    } catch (e) {
      if (!silent) console.warn('AutoPull error:', e);
      return false;
    } finally {
      this.isPulling = false;
      this.notifyStatus();
    }
  }

  // Two-way synchronization
  public async performSync(silent: boolean = false): Promise<boolean> {
    if (this.isSyncing || !this.isEnabled) return false;

    this.isSyncing = true;
    this.notifyStatus();

    try {
      // 1. Push all local records
      await StorageService.syncAllToAppwrite();
      // 2. Pull remote updates
      await StorageService.pullAllFromAppwrite();

      this.lastSyncTime = new Date();
      return true;
    } catch (e) {
      if (!silent) console.warn('AutoSync notice:', e);
      return false;
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  private notifyStatus() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('trigon_sync_status_updated', {
          detail: this.getStatus(),
        })
      );
    }
  }
}

export const AutoSyncService = new AutoSyncServiceClass();
