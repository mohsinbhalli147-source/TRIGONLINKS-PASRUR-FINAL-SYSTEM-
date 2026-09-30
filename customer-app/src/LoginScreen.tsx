import React, { useCallback, useEffect, useState } from 'react';
import { Lock, User2, Eye, EyeOff, Wifi, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from './auth';

const CNIC_PATTERN = /^\d{5}-?\d{7}-?\d$/;

export const LoginScreen: React.FC = () => {
  const { login, notice } = useAuth();
  const [userId, setUserId] = useState('');
  const [cnic, setCnic] = useState('');
  const [showCnic, setShowCnic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!userId.trim()) {
      setError('Enter your Trigon Links user ID.');
      return;
    }
    if (!CNIC_PATTERN.test(cnic.trim())) {
      setError('Enter your 13 digit CNIC, with or without dashes.');
      return;
    }

    setBusy(true);
    const result = await login(userId, cnic);
    if (!result.success) {
      setError(result.error ?? 'Could not sign in.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 px-5 py-8 safe-area">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
        <header className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/40">
            <Wifi className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Trigon Links</h1>
          <p className="text-sm text-slate-400 mt-1">Subscriber App</p>
        </header>

        <form
          onSubmit={submit}
          className="space-y-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-5"
          noValidate
        >
          <div>
            <label
              htmlFor="user-id"
              className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider"
            >
              User ID
            </label>
            <div className="relative">
              <User2
                className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="user-id"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError(null);
                }}
                placeholder="printed on your bill"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cnic"
              className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider"
            >
              CNIC Number
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="cnic"
                type={showCnic ? 'text' : 'password'}
                required
                inputMode="numeric"
                autoComplete="off"
                value={cnic}
                onChange={(e) => {
                  setCnic(e.target.value);
                  setError(null);
                }}
                placeholder="35202-1234567-1"
                className="w-full pl-10 pr-11 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
              <button
                type="button"
                onClick={() => setShowCnic((v) => !v)}
                aria-label={showCnic ? 'Hide CNIC' : 'Show CNIC'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showCnic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-900/60 rounded-2xl px-3 py-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-sm shadow-lg shadow-cyan-900/40 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        {notice && (
          <p className="mt-4 text-center text-xs text-amber-300/90 leading-relaxed">{notice}</p>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-500 leading-relaxed">
          Your user ID and CNIC are on your bill and activation slip. Lost them? Call the
          Trigon Links helpline and we will confirm your identity.
        </p>
      </div>
    </div>
  );
};
