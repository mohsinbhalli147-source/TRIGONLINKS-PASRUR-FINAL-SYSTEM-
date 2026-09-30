import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LogOut,
  Shield,
  Bell,
  Menu,
  Wifi,
  ChevronDown,
  Database,
  RefreshCw,
  Cloud,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { ALL_SECTIONS } from '../../types';
import { useBadgeCounts } from '../../hooks/useBadgeCounts';
import { AutoSyncService } from '../../services/autoSync';
import { useToast } from '../../context/ToastContext';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout, activeSection, setActiveSection } = useAuth();
  const { showToast } = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [syncStatus, setSyncStatus] = useState(AutoSyncService.getStatus());

  const {
    lowStock: lowStockCount,
    pendingComplaints: pendingComplaintsCount,
    pendingConnections: pendingConnectionsCount,
    pendingApprovals: pendingApprovalsCount,
  } = useBadgeCounts();

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setSyncStatus(detail);
    };

    window.addEventListener('trigon_sync_status_updated', handleSyncStatus);

    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('trigon_sync_status_updated', handleSyncStatus);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleQuickSync = async () => {
    const success = await AutoSyncService.performSync(false);
    if (success) {
      showToast('success', 'Realtime Sync Active', 'Laptop & mobile are now 100% in sync!');
    }
  };

  const currentSectionMeta = ALL_SECTIONS.find((s) => s.id === activeSection);
  const totalNotifications = lowStockCount + pendingComplaintsCount + pendingConnectionsCount + pendingApprovalsCount;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Mobile toggle & Brand & Current Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
          title="Toggle Navigation"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/30 font-black tracking-wider">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              TRIGON <span className="text-cyan-400">LINKS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 uppercase">
                ISP Suite
              </span>
            </span>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-2 hidden sm:block" />

        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            {currentSectionMeta?.group || 'Portal'}
          </span>
          <span className="text-slate-600">/</span>
          <span className="font-semibold text-slate-200">{currentSectionMeta?.name || 'Dashboard'}</span>
        </div>
      </div>

      {/* Right side: AutoSync status, Notifications, Appwrite DB (Admin Only), User info, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live AutoSync Trigger Button */}
        <button
          onClick={handleQuickSync}
          disabled={syncStatus.isSyncing}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
            syncStatus.isSyncing
              ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300 animate-pulse'
              : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white hover:border-cyan-500/50'
          }`}
          title="Auto-Sync: Syncs live data between laptop & mobile automatically"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin text-cyan-400' : 'text-emerald-400'}`} />
          <span className="hidden md:inline font-bold text-[11px]">
            {syncStatus.isSyncing ? 'Syncing...' : 'Auto-Sync Live'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse" />
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors relative"
            title="Operational Alerts"
            aria-label={`Notifications (${totalNotifications} active)`}
          >
            <Bell className="w-5 h-5" />
            {totalNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-semibold text-sm text-slate-200">Alerts &amp; Operational Notices</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {totalNotifications} Active
                </span>
              </div>
              <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto text-xs">
                {pendingApprovalsCount > 0 && (
                  <div
                    onClick={() => {
                      setActiveSection('deletion-requests');
                      setShowNotifications(false);
                    }}
                    className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-200 flex items-center justify-between cursor-pointer hover:bg-rose-950/60"
                  >
                    <span>🛡️ {pendingApprovalsCount} Pending Admin Approvals</span>
                    <span className="font-bold underline text-[11px]">Review</span>
                  </div>
                )}
                {pendingComplaintsCount > 0 && (
                  <div
                    onClick={() => {
                      setActiveSection('complaints');
                      setShowNotifications(false);
                    }}
                    className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 flex items-center justify-between cursor-pointer hover:bg-amber-950/60"
                  >
                    <span>⚠️ {pendingComplaintsCount} Pending Complaints unresolved</span>
                    <span className="font-bold underline text-[11px]">View</span>
                  </div>
                )}
                {lowStockCount > 0 && (
                  <div
                    onClick={() => {
                      setActiveSection('stock-alerts');
                      setShowNotifications(false);
                    }}
                    className="p-2.5 rounded-xl bg-orange-950/40 border border-orange-800/40 text-orange-200 flex items-center justify-between cursor-pointer hover:bg-orange-950/60"
                  >
                    <span>📦 {lowStockCount} Inventory items below threshold</span>
                    <span className="font-bold underline text-[11px]">Restock</span>
                  </div>
                )}
                {pendingConnectionsCount > 0 && (
                  <div
                    onClick={() => {
                      setActiveSection('connections');
                      setShowNotifications(false);
                    }}
                    className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 flex items-center justify-between cursor-pointer hover:bg-cyan-950/60"
                  >
                    <span>🌐 {pendingConnectionsCount} New connection requests</span>
                    <span className="font-bold underline text-[11px]">Approve</span>
                  </div>
                )}
                {totalNotifications === 0 && (
                  <p className="text-center py-4 text-slate-400">All systems normal. No pending alerts.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Badge & Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
            aria-label="User Account Menu"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-slate-200 leading-tight truncate max-w-[130px]">
                {user?.name || 'Account'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                    user?.role === 'Admin'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      : 'bg-blue-950 text-blue-400 border border-blue-800/60'
                  }`}
                >
                  {user?.role || 'Staff'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-slate-300 font-medium">Role: {user?.role}</span>
                </div>
              </div>

              {/* Secure Logout Button */}
              <div className="pt-2">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out Securely
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
