import React, { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { WebAdminLoginPage } from './components/views/WebAdminLoginPage';
import { Loader2, ShieldAlert } from 'lucide-react';

/**
 * Staff and administration panel.
 *
 * The subscriber experience is a separate, phone-first app (see
 * `customer-app/`) that talks to the same server through /api/portal. Nothing
 * subscriber-facing is bundled or served from here.
 *
 * The entry is deliberately small. Everything an operator only needs *after*
 * signing in - the storage engine, the auto-sync timers, the navigation chrome
 * and all twenty-two module views - lives behind the dynamic import below, so
 * the sign-in screen loads without them. The login page itself stays eager,
 * because it is what an unauthenticated visitor is waiting for, and the session
 * check that decides which of the two to show is part of `AuthProvider`.
 */
const MainLayout = lazy(() =>
  import('./components/layout/MainLayout').then((m) => ({ default: m.MainLayout }))
);

const ShellLoadingFallback = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 font-sans">
    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    <p className="text-xs text-slate-400 font-medium tracking-wide">Loading workspace...</p>
  </div>
);

const AuthGate: React.FC = () => {
  const { isAuthenticated, isLoading, bootstrap } = useAuth();

  // These three gates mirror the ones the shell used to own, so that moving it
  // behind a dynamic import does not change what is on screen at any point.
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

  // Only mount the authenticated shell once there is a session. Rendering the
  // login page for an unauthenticated visitor keeps the heavy modules out of
  // that visitor's first load entirely.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
        <main className="flex-1">
          <WebAdminLoginPage />
        </main>
      </div>
    );
  }

  return (
    <Suspense fallback={<ShellLoadingFallback />}>
      <MainLayout />
    </Suspense>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ToastProvider>
  );
}
