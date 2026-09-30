import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  AlertCircle,
  CreditCard,
  Menu,
  GitPullRequest,
} from 'lucide-react';
import { useBadgeCounts } from '../../hooks/useBadgeCounts';

interface MobileBottomNavProps {
  onOpenSidebar: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenSidebar }) => {
  const { activeSection, setActiveSection, hasSectionAccess } = useAuth();
  const {
    pendingComplaints,
    pendingConnections,
    dueInvoices,
  } = useBadgeCounts();

  const items = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      badge: 0,
      show: true,
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      badge: 0,
      show: hasSectionAccess('customers'),
    },
    {
      id: 'complaints',
      label: 'Faults',
      icon: AlertCircle,
      badge: pendingComplaints,
      show: hasSectionAccess('complaints'),
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: CreditCard,
      badge: dueInvoices > 0 ? dueInvoices : 0,
      show: hasSectionAccess('payments') || hasSectionAccess('invoices'),
    },
    {
      id: 'connections',
      label: 'Requests',
      icon: GitPullRequest,
      badge: pendingConnections,
      show: !hasSectionAccess('payments') && hasSectionAccess('connections'),
    },
  ].filter((item) => item.show);

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 pb-[calc(env(safe-area-inset-bottom,0.5rem)+0.25rem)] shadow-2xl"
    >
      <div className="flex items-center justify-around">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                isActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />}
            </button>
          );
        })}

        {/* Modules Button */}
        <button
          onClick={onOpenSidebar}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
        >
          <Menu className="w-5 h-5 stroke-2" />
          <span className="text-[10px] mt-0.5 tracking-tight">Modules</span>
        </button>
      </div>
    </nav>
  );
};
