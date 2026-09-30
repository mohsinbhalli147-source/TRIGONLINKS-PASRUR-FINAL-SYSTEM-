import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBadgeCounts } from '../../hooks/useBadgeCounts';
import { SectionId, ALL_SECTIONS } from '../../types';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Wifi,
  GitPullRequest,
  Calculator,
  Receipt,
  CreditCard,
  Clock,
  AlertCircle,
  Ticket,
  Activity,
  UserCheck,
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  Megaphone,
  BarChart3,
  Settings,
  ShieldCheck,
  History,
  Building2,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  MapPin,
  Wifi,
  GitPullRequest,
  Calculator,
  Receipt,
  CreditCard,
  Clock,
  AlertCircle,
  Ticket,
  Activity,
  UserCheck,
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  Megaphone,
  BarChart3,
  Settings,
  ShieldCheck,
  History,
  Building2,
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, activeSection, setActiveSection, hasSectionAccess } = useAuth();
  const { showToast } = useToast();

  const {
    pendingComplaints,
    lowStock,
    pendingConnections: pendingConns,
    dueInvoices,
    pendingApprovals,
    activeCustomers: activeCusts,
  } = useBadgeCounts();

  const handleSectionClick = (sectionId: SectionId) => {
    if (!hasSectionAccess(sectionId)) {
      showToast('denied', 'Access Denied', `Your account permissions do not permit access to "${sectionId}". Contact Admin.`);
      return;
    }
    setActiveSection(sectionId);
    if (onClose) onClose();
  };

  // Group sections
  const groups: string[] = Array.from(new Set(ALL_SECTIONS.map((s) => s.group)));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 lg:top-16 left-0 h-screen lg:h-[calc(100vh-4rem)] w-72 bg-slate-900 border-r border-slate-800 z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {groups.map((groupName) => {
            const groupSections = ALL_SECTIONS.filter((s) => s.group === groupName);

            const visibleSections = groupSections.filter((s) => {
              if (user?.role === 'Admin') return true;
              return user?.allowedSections.includes(s.id);
            });

            if (visibleSections.length === 0) return null;

            return (
              <div key={groupName} className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400/90 flex items-center justify-between">
                  <span>{groupName}</span>
                </div>

                <div className="space-y-0.5">
                  {visibleSections.map((sec) => {
                    const IconComponent = ICON_MAP[sec.icon] || LayoutDashboard;
                    const isActive = activeSection === sec.id;

                    // Badge counter
                    let badge: React.ReactNode = null;
                    if (sec.id === 'complaints' && pendingComplaints > 0) {
                      badge = (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {pendingComplaints}
                        </span>
                      );
                    } else if (sec.id === 'stock-alerts' && lowStock > 0) {
                      badge = (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {lowStock}
                        </span>
                      );
                    } else if (sec.id === 'connections' && pendingConns > 0) {
                      badge = (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          {pendingConns}
                        </span>
                      );
                    } else if (sec.id === 'due-payments' && dueInvoices > 0) {
                      badge = (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {dueInvoices}
                        </span>
                      );
                    } else if (sec.id === 'deletion-requests' && pendingApprovals > 0) {
                      badge = (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                          {pendingApprovals}
                        </span>
                      );
                    } else if (sec.id === 'customers') {
                      badge = (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {activeCusts}
                        </span>
                      );
                    }

                    return (
                      <button
                        key={sec.id}
                        onClick={() => handleSectionClick(sec.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 text-cyan-300 border border-cyan-800/60 shadow-md shadow-cyan-950/40'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IconComponent
                            className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                              isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate">{sec.name}</span>
                        </div>
                        {badge}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};
