import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StorageService } from '../../services/storage';
import { AutoSyncService } from '../../services/autoSync';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

/**
 * The authenticated staff shell.
 *
 * This lives in its own module, loaded with a dynamic import, so that the
 * sign-in page does not have to download the storage engine, the auto-sync
 * timers or any of the module views before an operator has signed in. Nothing
 * here is reachable until `/api/auth/session` has confirmed a session, so
 * deferring it cannot change what the login screen does.
 */

// Code-split views for a fast initial load.
const DashboardView = lazy(() => import('../views/DashboardView').then((m) => ({ default: m.DashboardView })));
const CustomersView = lazy(() => import('../views/CustomersView').then((m) => ({ default: m.CustomersView })));
const ConnectionsView = lazy(() => import('../views/ConnectionsView').then((m) => ({ default: m.ConnectionsView })));
const AreasView = lazy(() => import('../views/AreasView').then((m) => ({ default: m.AreasView })));
const PackagesView = lazy(() => import('../views/PackagesView').then((m) => ({ default: m.PackagesView })));
const BillingView = lazy(() => import('../views/BillingView').then((m) => ({ default: m.BillingView })));
const InvoicesView = lazy(() => import('../views/InvoicesView').then((m) => ({ default: m.InvoicesView })));
const PaymentsView = lazy(() => import('../views/PaymentsView').then((m) => ({ default: m.PaymentsView })));
const DuePaymentsView = lazy(() => import('../views/DuePaymentsView').then((m) => ({ default: m.DuePaymentsView })));
const ComplaintsView = lazy(() => import('../views/ComplaintsView').then((m) => ({ default: m.ComplaintsView })));
const StaffView = lazy(() => import('../views/StaffView').then((m) => ({ default: m.StaffView })));
const StaffPerformanceView = lazy(() => import('../views/StaffPerformanceView').then((m) => ({ default: m.StaffPerformanceView })));
const InventoryView = lazy(() => import('../views/InventoryView').then((m) => ({ default: m.InventoryView })));
const StockAlertsView = lazy(() => import('../views/StockAlertsView').then((m) => ({ default: m.StockAlertsView })));
const ExpensesView = lazy(() => import('../views/ExpensesView').then((m) => ({ default: m.ExpensesView })));
const MessagesView = lazy(() => import('../views/MessagesView').then((m) => ({ default: m.MessagesView })));
const AnnouncementsView = lazy(() => import('../views/AnnouncementsView').then((m) => ({ default: m.AnnouncementsView })));
const ReportsView = lazy(() => import('../views/ReportsView').then((m) => ({ default: m.ReportsView })));
const CompanyProfileView = lazy(() => import('../views/CompanyProfileView').then((m) => ({ default: m.CompanyProfileView })));
const ActivityLogsView = lazy(() => import('../views/ActivityLogsView').then((m) => ({ default: m.ActivityLogsView })));
const DeletionRequestsView = lazy(() => import('../views/DeletionRequestsView').then((m) => ({ default: m.DeletionRequestsView })));

const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      <p className="text-xs text-slate-400 font-medium tracking-wide">Loading module view...</p>
    </div>
  </div>
);

export const MainLayout: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    bootstrap,
    activeSection,
    setActiveSection,
    hasSectionAccess,
  } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    StorageService.initRealtimeSync();
    AutoSyncService.init();
    return () => {
      StorageService.stopRealtimeSync();
      AutoSyncService.stop();
    };
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 font-sans">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">Verifying your session...</p>
      </div>
    );
  }

  if (bootstrap.state === 'unprovisioned' || bootstrap.state === 'offline') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-lg w-full rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-white">
            {bootstrap.state === 'offline' ? 'Cannot reach the server' : 'Setup required'}
          </h1>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">{bootstrap.message}</p>
          <p className="text-[11px] text-slate-500 mt-5 leading-relaxed">
            Sign-in is disabled until this is resolved, so no data is served or stored insecurely.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const renderActiveSection = () => {
    // RBAC section access check
    if (!hasSectionAccess(activeSection)) {
      return (
        <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center max-w-lg mx-auto mt-12">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">Access Restricted</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Your assigned role does not hold permission to inspect or modify the <strong>{activeSection}</strong> module. Please contact the Trigon Links Super Admin.
          </p>
          <button
            onClick={() => setActiveSection('dashboard')}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </button>
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />;
      case 'customers':
        return <CustomersView />;
      case 'connections':
        return <ConnectionsView />;
      case 'areas':
        return <AreasView />;
      case 'packages':
        return <PackagesView />;
      case 'billing':
        return <BillingView />;
      case 'invoices':
        return <InvoicesView />;
      case 'payments':
        return <PaymentsView />;
      case 'due-payments':
        return <DuePaymentsView />;
      case 'complaints':
        return <ComplaintsView />;
      case 'staff':
        return <StaffView />;
      case 'staff-performance':
        return <StaffPerformanceView />;
      case 'inventory':
        return <InventoryView />;
      case 'stock-alerts':
        return <StockAlertsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'messages':
        return <MessagesView />;
      case 'announcements':
        return <AnnouncementsView />;
      case 'reports':
        return <ReportsView />;
      case 'company-profile':
        return <CompanyProfileView />;
      case 'activity-logs':
        return <ActivityLogsView />;
      case 'deletion-requests':
        return <DeletionRequestsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Navbar onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-64px-36px)] pb-20 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<ViewLoadingFallback />}>
              {renderActiveSection()}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav onOpenSidebar={() => setIsMobileSidebarOpen(true)} />
    </div>
  );
};
