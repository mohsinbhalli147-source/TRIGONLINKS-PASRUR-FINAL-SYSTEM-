import React from 'react';
import { AuthProvider, useAuth } from './auth';
import { LoginScreen } from './LoginScreen';
import { HomeScreen } from './HomeScreen';
import { Loader2, WifiOff } from 'lucide-react';

const Root: React.FC = () => {
  const { status, profile, notice, logout } = useAuth();

  if (status === 'checking') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-slate-950">
        <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
        <p className="text-xs text-slate-400">Checking your session...</p>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-800/60 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-6 h-6" />
          </div>
          <h1 className="text-base font-black text-white">Cannot reach Trigon Links</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {notice ?? 'Please check your internet connection and try again.'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'signed-in' && profile) {
    return <HomeScreen name={profile.name} onSignOut={() => void logout()} />;
  }

  return <LoginScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
