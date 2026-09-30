import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'denied';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    setToasts((prev) => {
      // Limit to 4 concurrent toasts to avoid viewport clutter
      const current = prev.length >= 4 ? prev.slice(prev.length - 3) : prev;
      return [...current, { id, type, title, message }];
    });

    const timeout = setTimeout(() => {
      removeToast(id);
    }, 4500);

    timeoutsRef.current.set(id, timeout);
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="System Notifications"
        className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-[calc(100vw-2rem)] sm:w-full"
      >
        {toasts.map((toast) => {
          let bgClass = 'bg-slate-900 border-slate-700 text-slate-100 shadow-2xl';
          let icon = <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />;

          if (toast.type === 'success') {
            bgClass = 'bg-emerald-950/95 border-emerald-600/60 text-emerald-100 shadow-xl shadow-emerald-950/60';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
          } else if (toast.type === 'error') {
            bgClass = 'bg-rose-950/95 border-rose-600/60 text-rose-100 shadow-xl shadow-rose-950/60';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
          } else if (toast.type === 'warning') {
            bgClass = 'bg-amber-950/95 border-amber-600/60 text-amber-100 shadow-xl shadow-amber-950/60';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
          } else if (toast.type === 'denied') {
            bgClass = 'bg-red-950/95 border-red-500 text-red-100 shadow-xl shadow-red-950/60 ring-1 ring-red-500/40';
            icon = <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border backdrop-blur-xl transition-all duration-200 animate-in fade-in slide-in-from-top-4 ${bgClass}`}
            >
              {icon}
              <div className="flex-1 min-w-0 pr-1">
                <p className="font-bold text-xs sm:text-sm leading-snug tracking-tight">{toast.title}</p>
                {toast.message && (
                  <p className="text-[11px] sm:text-xs text-slate-300/90 mt-0.5 leading-relaxed break-words">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                title="Dismiss"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
