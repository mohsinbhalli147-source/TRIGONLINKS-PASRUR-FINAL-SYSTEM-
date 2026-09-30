import React, { useState } from 'react';
import { StaffMember, Area, SectionId, FunctionPermission, ALL_SECTIONS, ALL_FUNCTIONS } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { ApiError, resetAccountPassword } from '../../services/authApi';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  UserCheck,
  Plus,
  Shield,
  Search,
  Key,
  Power,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  Sparkles,
  RotateCcw,
  CheckCircle2,
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
  TrendingUp,
  Package,
  DollarSign,
  MessageSquare,
  Megaphone,
  BarChart3,
  Building2,
  ShieldCheck,
  History,
  Layers,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Wallet,
  ArrowDownLeft,
  Calendar,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { PermissionsModal } from '../modals/PermissionsModal';
import { StaffSettlementModal } from '../modals/StaffSettlementModal';

const SECTION_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
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
  UserCheck,
  TrendingUp,
  Package,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  Megaphone,
  BarChart3,
  Building2,
  ShieldCheck,
  History,
};

export const StaffView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [{ staff, areas, settlements }, refreshData] = useStorageCollections({
    staff: () => StorageService.getStaff(),
    areas: () => StorageService.getAreas(),
    settlements: () => StorageService.getStaffSettlements(),
  });
  const [search, setSearch] = useState('');

  const [roleFilter, setRoleFilter] = useState('All');

  // Main Tabs: Directory vs Recovery Cashbook
  const [staffMainTab, setStaffMainTab] = useState<'directory' | 'cashbook'>('directory');

  // Settlement Modal state
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementStaff, setSettlementStaff] = useState<StaffMember | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [editingPermissionsStaff, setEditingPermissionsStaff] = useState<StaffMember | null>(null);

  // Form Tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'sections' | 'functions'>('profile');

  // Form Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffMember['role']>('Technician');
  const [assignedAreaIds, setAssignedAreaIds] = useState<string[]>([]);
  const [allowedSections, setAllowedSections] = useState<SectionId[]>([]);
  const [allowedFunctions, setAllowedFunctions] = useState<FunctionPermission[]>([]);

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [issuedCredential, setIssuedCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Quick Preset Helper

  const applyPreset = (preset: 'admin' | 'technician' | 'support' | 'accounts' | 'clear') => {
    if (preset === 'admin') {
      setAllowedSections(ALL_SECTIONS.map((s) => s.id));
      setAllowedFunctions(ALL_FUNCTIONS.map((f) => f.id));
      setRole('Admin');
      showToast('info', 'Admin Preset Applied', 'All sections & operational functions enabled.');
    } else if (preset === 'technician') {
      setAllowedSections(['dashboard', 'customers', 'connections', 'complaints', 'inventory', 'stock-alerts']);
      setAllowedFunctions(['add_customers', 'edit_customers', 'approve_connections', 'manage_inventory']);
      setRole('Technician');
      showToast('info', 'Technician Preset Applied', 'Field & hardware permissions enabled.');
    } else if (preset === 'support') {
      setAllowedSections(['dashboard', 'customers', 'invoices', 'complaints', 'messages', 'announcements']);
      setAllowedFunctions(['edit_customers', 'receive_payments', 'send_messages', 'view_reports']);
      setRole('Support');
      showToast('info', 'Support Preset Applied', 'Ticketing and billing support enabled.');
    } else if (preset === 'accounts') {
      setAllowedSections(['dashboard', 'customers', 'billing', 'invoices', 'payments', 'due-payments', 'expenses', 'reports']);
      setAllowedFunctions(['receive_payments', 'generate_bills', 'view_reports', 'export_data']);
      setRole('Accounts');
      showToast('info', 'Accounts Preset Applied', 'Billing & cash collection enabled.');
    } else if (preset === 'clear') {
      setAllowedSections(['dashboard']);
      setAllowedFunctions([]);
      showToast('info', 'Permissions Cleared', 'Only basic dashboard access left.');
    }
  };

  // Open Add Modal
  const openAdd = () => {
    setEditingStaff(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('staff123');
    setPhone('');
    setRole('Technician');
    setAssignedAreaIds([]);
    // Default technician permissions
    setAllowedSections(['dashboard', 'customers', 'connections', 'complaints', 'inventory', 'stock-alerts']);
    setAllowedFunctions(['add_customers', 'edit_customers', 'approve_connections', 'manage_inventory']);
    setShowPassword(false);
    setActiveTab('profile');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const openEdit = (st: StaffMember) => {
    setEditingStaff(st);
    setName(st.name);
    setUsername(st.username || st.email.split('@')[0]);
    setEmail(st.email);
    setPassword(st.password || 'staff123');
    setPhone(st.phone || st.mobile || '');
    setRole(st.role);
    setAssignedAreaIds(st.assignedAreaIds || []);
    setAllowedSections(st.allowedSections && st.allowedSections.length > 0 ? st.allowedSections : ['dashboard']);
    setAllowedFunctions(st.allowedFunctions || []);
    setShowPassword(false);
    setActiveTab('profile');
    setIsFormModalOpen(true);
  };

  // Checkbox Handlers for Sections
  const toggleSection = (id: SectionId) => {
    setAllowedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAllSections = () => {
    setAllowedSections(ALL_SECTIONS.map((s) => s.id));
  };

  const deselectAllSections = () => {
    setAllowedSections(['dashboard']);
  };

  // Checkbox Handlers for Functions
  const toggleFunction = (id: FunctionPermission) => {
    setAllowedFunctions((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const selectAllFunctions = () => {
    setAllowedFunctions(ALL_FUNCTIONS.map((f) => f.id));
  };

  const deselectAllFunctions = () => {
    setAllowedFunctions([]);
  };

  // Coverage Area toggle
  const toggleArea = (areaId: string) => {
    setAssignedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  // Save Staff (Add / Edit)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    // Creating or editing a staff account is how you mint an administrator, so
    // it is an administrator-only action. Previously any account with access to
    // this section could grant itself role: 'Admin' and every permission.
    if (!isAdmin) {
      showToast(
        'error',
        'Administrator access required',
        'Only a Super Admin can create or change staff accounts.'
      );
      return;
    }

    if (!name.trim() || !email.trim()) {
      showToast('error', 'Required Fields Missing', 'Please enter staff name and email.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username.trim() || cleanEmail.split('@')[0]).toLowerCase();

    // Ensure dashboard is always included as minimum section
    const finalSections = allowedSections.includes('dashboard')
      ? allowedSections
      : ['dashboard' as SectionId, ...allowedSections];

    if (editingStaff) {
      // Check duplicate email against other staff
      const duplicate = staff.some(
        (s) => s.id !== editingStaff.id && (s.email.toLowerCase() === cleanEmail || (s.username && s.username.toLowerCase() === cleanUsername))
      );
      if (duplicate) {
        showToast('error', 'Identifier Taken', 'Another staff member with this email or username already exists.');
        return;
      }

      const updated: StaffMember = {
        ...editingStaff,
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        phone: phone.trim(),
        mobile: phone.trim(),
        role,
        assignedAreaIds,
        allowedSections: finalSections,
        allowedFunctions,
      };

      // The password is deliberately omitted: it lives in the account system,
      // not in a record the browser can read. Use "Issue password" instead.
      delete (updated as Partial<StaffMember>).password;

      StorageService.saveStaff(updated, user?.email);
      showToast('success', 'Staff Member Updated', `${name}'s account and access sections have been saved.`);
      setIsFormModalOpen(false);
      setEditingStaff(null);
      refreshData();

      if (password.trim()) {

        await issuePassword(updated.id, password.trim());
        setPassword('');
      }
    } else {
      // Check duplicate for new staff
      const duplicate = staff.some(
        (s) => s.email.toLowerCase() === cleanEmail || (s.username && s.username.toLowerCase() === cleanUsername)
      );
      if (duplicate) {
        showToast('error', 'Identifier Taken', 'A staff member with this email or username already exists.');
        return;
      }

      const newStaff: StaffMember = {
        id: `staff-${Date.now()}`,
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        phone: phone.trim(),
        mobile: phone.trim(),
        role,
        status: 'Active',
        assignedAreaIds,
        allowedSections: finalSections,
        allowedFunctions,
        createdAt: new Date().toISOString().split('T')[0],
      };

      StorageService.saveStaff(newStaff, user?.email);
      showToast('success', 'Staff Member Created', `${name} registered with ${finalSections.length} sections and ${allowedFunctions.length} function access.`);
      setIsFormModalOpen(false);
      refreshData();

      // Issue the first password so the account is actually usable.

      await issuePassword(newStaff.id);
    }
  };

  /**
   * Sets a staff account password.
   *
   * Passwords are stored hashed by the account system, so the server sets them
   * and the record the browser holds never contains one. With no chosenPassword
   * the server generates a strong one, returned exactly once.
   *
   * There is no subscriber equivalent: subscribers sign in with their CNIC, so
   * there is no password to issue. Correct a subscriber's CNIC on their record
   * and re-run "npm run provision".
   */
  const issuePassword = async (entityId: string, chosenPassword?: string) => {
    try {
      const result = await resetAccountPassword({
        entityId,
        ...(chosenPassword ? { newPassword: chosenPassword } : {}),
      });
      setIssuedCredential({ email: result.email, password: result.password });
      showToast(
        'success',
        'Password set',
        'Copy it now and hand it over securely. It cannot be shown again.'
      );
    } catch (error) {
      showToast(
        'error',
        'Could not set password',
        error instanceof ApiError
          ? error.message
          : 'The account may not be provisioned yet. Run "npm run provision".'
      );
    }
  };

  // Toggle Suspend / Active
  const handleToggleStatus = (st: StaffMember) => {
    if (!isAdmin) {
      showToast('error', 'Administrator access required', 'Only a Super Admin can change staff status.');
      return;
    }
    if (user?.email === st.email || user?.staffId === st.id) {
      showToast('error', 'Action Restricted', 'You cannot suspend your own signed-in account.');
      return;
    }
    const newStatus = st.status === 'Active' ? 'Suspended' : 'Active';
    const updated = { ...st, status: newStatus as StaffMember['status'] };
    StorageService.saveStaff(updated, user?.email);
    refreshData();
    showToast(
      newStatus === 'Active' ? 'success' : 'warning',

      `Staff ${newStatus}`,
      `${st.name} account is now ${newStatus}.`
    );
  };

  // Delete Staff confirmation flow
  const handleDeleteClick = (st: StaffMember) => {
    if (!isAdmin) {
      showToast('error', 'Administrator access required', 'Only a Super Admin can remove staff accounts.');
      return;
    }
    if (user?.email === st.email || user?.staffId === st.id) {
      showToast('error', 'Cannot Delete Self', 'You cannot delete your own signed-in account.');
      return;
    }
    if (st.role === 'Admin' && staff.filter((s) => s.role === 'Admin').length <= 1) {
      showToast('error', 'Last Administrator', 'The final Super Admin account cannot be removed.');
      return;
    }
    setStaffToDelete(st);
  };

  const confirmDeleteStaff = () => {
    if (!staffToDelete) return;
    StorageService.deleteStaff(staffToDelete.id, user?.email);
    showToast('success', 'Staff Deleted', `${staffToDelete.name} has been permanently deleted from workforce.`);
    setStaffToDelete(null);
    if (editingStaff?.id === staffToDelete.id) {
      setIsFormModalOpen(false);
      setEditingStaff(null);
    }
    refreshData();
  };


  /**
   * Copies sign-in details.
   *
   * The password is no longer part of the staff record, so this copies the
   * account identifier only. Use "Issue password" to hand over a new one.
   */
  const handleCopyCredentials = (st: StaffMember) => {
    const text = `Trigon Links ISP Portal Access\nStaff Name: ${st.name}\nEmail / Username: ${st.email} (or ${st.username || st.email.split('@')[0]})\nDesignation: ${st.role}\nAllowed Sections: ${st.allowedSections?.length || 0} modules`;
    navigator.clipboard.writeText(text);
    setCopiedId(st.id);
    showToast('info', 'Sign-in details copied', `Sign-in address for ${st.name} copied. The password is not stored on this device.`);
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Group sections for tidy display
  const sectionGroups: string[] = Array.from(new Set(ALL_SECTIONS.map((s) => s.group)));

  // Filtered staff list
  const filtered = staff.filter((s) => {
    const p = s.phone || s.mobile || '';
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.username && s.username.toLowerCase().includes(search.toLowerCase())) ||
      p.includes(search);
    const matchesRole = roleFilter === 'All' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-cyan-400" />
            Staff &amp; Workforce Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage staff accounts, custom passwords, section access checkboxes, and working function permissions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
             type="button"
            onClick={() => setStaffMainTab(staffMainTab === 'directory' ? 'cashbook' : 'directory')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs border border-emerald-800/40 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            {staffMainTab === 'directory' ? 'Staff Recovery & Cashbook' : 'Staff Directory'}
          </button>

          <button
             type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            + Add Staff Member
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-bold">
        <button
           type="button"
          onClick={() => setStaffMainTab('directory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            staffMainTab === 'directory'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory &amp; RBAC Access</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] ${
            staffMainTab === 'directory' ? 'bg-slate-950 text-cyan-300 font-mono' : 'bg-slate-800 text-cyan-400'
          }`}>
            {staff.length}
          </span>
        </button>

        <button
           type="button"
          onClick={() => setStaffMainTab('cashbook')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            staffMainTab === 'cashbook'
              ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Recovery Cashbook &amp; Collections Ledger</span>
          {(() => {
            const totalInHand = staff.reduce((acc, s) => acc + StorageService.getStaffCashBalance(s).inHandBalance, 0);
            return totalInHand > 0 ? (
              <span className={`px-2 py-0.2 rounded-full text-[10px] ${
                staffMainTab === 'cashbook' ? 'bg-slate-950 text-emerald-300 font-mono' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                Rs. {totalInHand.toLocaleString()}
              </span>
            ) : null;
          })()}
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY VIEW */}
      {staffMainTab === 'directory' && (
        <div className="space-y-6">

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff name, email, username, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-slate-400 font-semibold whitespace-nowrap">Filter Designation:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
          >
            <option value="All">All Designations ({staff.length})</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Technician">Field Technician</option>
            <option value="Support">Support Agent</option>
            <option value="Accounts">Accounts Officer</option>
          </select>
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((st) => (
          <div
            key={st.id}
            className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-800/80 transition-all shadow-xl flex flex-col justify-between group"
          >
            <div>
              {/* Card Header: Avatar & Designation */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-300 font-black text-lg flex items-center justify-center shadow-md">
                    {st.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">{st.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-medium">
                        {st.role}
                      </span>
                      {st.assignedAreaIds && st.assignedAreaIds.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
                          {st.assignedAreaIds.length} Areas
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    st.status === 'Active'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {st.status}
                </span>
              </div>

              {/* Contact Info */}
              <div className="mt-4 space-y-1.5 text-xs text-slate-300">
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-mono truncate">{st.email}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-mono">{st.phone || st.mobile || 'No contact'}</span>
                </p>
              </div>

              {/* Login Credentials Box */}
              <div className="mt-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-cyan-400" /> Password:
                  </span>
                  <span className="font-mono font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    Held by the account system
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                  <span>
                    Login ID: <strong className="text-slate-200 font-mono">{st.username || st.email.split('@')[0]}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(st)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                  >
                    {copiedId === st.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Login
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Access Overview Badges */}
              <div className="mt-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Section Access</span>
                  <p className="font-extrabold text-cyan-400 font-mono text-sm mt-0.5">
                    {st.allowedSections?.length || 0} <span className="text-[10px] text-slate-500 font-normal">/ {ALL_SECTIONS.length}</span>
                  </p>
                </div>
                <div className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Working Access</span>
                  <p className="font-extrabold text-blue-400 font-mono text-sm mt-0.5">
                    {st.allowedFunctions?.length || 0} <span className="text-[10px] text-slate-500 font-normal">/ {ALL_FUNCTIONS.length}</span>
                  </p>
                </div>
              </div>

              {/* Staff Cash In-Hand & Recovery Widget */}
              {(() => {
                const bal = StorageService.getStaffCashBalance(st);
                return (
                  <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-emerald-400" /> Cash In-Hand:
                      </span>
                      <span className={`font-mono font-black px-2 py-0.5 rounded text-xs ${
                        bal.inHandBalance > 0
                          ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
                          : 'text-slate-400 bg-slate-900'
                      }`}>
                        Rs. {bal.inHandBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                      <span>Total Recovered: Rs. {bal.totalCollected.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSettlementStaff(st);
                          setIsSettlementModalOpen(true);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-0.5"
                      >
                        Cash Handover &rarr;
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Actions Bar */}
            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
              <button
                 type="button"
                onClick={() => {
                  setSettlementStaff(st);
                  setIsSettlementModalOpen(true);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold text-xs transition-colors"
                title="Handover Cash to Admin"
              >
                <Wallet className="w-3.5 h-3.5" />
                Settle
              </button>

              <button
                 type="button"
                onClick={() => openEdit(st)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
                title="Edit Staff, Reset Password & Manage Checkboxes"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                Edit
              </button>

              <button
                 type="button"
                onClick={() => setEditingPermissionsStaff(st)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 font-bold text-xs transition-colors"
                title="Quick Matrix Modal"
              >
                <Key className="w-3.5 h-3.5" />
                Permissions
              </button>

              <button
                 type="button"
                onClick={() => handleToggleStatus(st)}
                className={`p-2 rounded-xl border transition-colors ${
                  st.status === 'Active'
                    ? 'border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30'
                    : 'border-emerald-800 text-emerald-400 bg-emerald-950/30'
                }`}
                title={st.status === 'Active' ? 'Suspend Account' : 'Activate Account'}
              >
                <Power className="w-4 h-4" />
              </button>

              <button
                 type="button"
                onClick={() => handleDeleteClick(st)}
                className="p-2 rounded-xl border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-900/60 hover:bg-rose-950/30 transition-colors"
                title="Permanently Delete Staff Member"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
      )}

      {/* TAB 2: RECOVERY CASHBOOK & SETTLEMENTS */}
      {staffMainTab === 'cashbook' && (
        <div className="space-y-6">
          {/* 4 Financial KPI Cards */}
          {(() => {
            const allStaffBalances = staff.map((s) => StorageService.getStaffCashBalance(s));
            const totalCollected = allStaffBalances.reduce((sum, b) => sum + b.totalCollected, 0);
            const totalSettled = allStaffBalances.reduce((sum, b) => sum + b.totalSettled, 0);
            const totalInHand = allStaffBalances.reduce((sum, b) => sum + b.inHandBalance, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-700/60 text-cyan-400 flex items-center justify-center shrink-0">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-bold block">Total Cash Recovered</span>
                    <span className="text-xl font-black text-cyan-400 font-mono mt-0.5 block">
                      Rs. {totalCollected.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500">Collected by all field staff</span>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-blue-950 border border-blue-700/60 text-blue-400 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-bold block">Handed Over to Admin</span>
                    <span className="text-xl font-black text-blue-400 font-mono mt-0.5 block">
                      Rs. {totalSettled.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500">{settlements.length} settlement vouchers</span>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900 border-2 border-emerald-800/80 flex items-center gap-4 shadow-lg">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center shrink-0">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-300 uppercase font-bold block">In-Hand Cash (Pending)</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">
                      Rs. {totalInHand.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">Held by staff pending deposit</span>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between p-5 shadow-lg">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-bold block">Settlement Actions</span>
                    <span className="text-sm font-bold text-white mt-1 block">Manual Cash Transfer</span>
                    <span className="text-[10px] text-slate-500">Deposit into Admin account</span>
                  </div>
                  <button
                     type="button"
                    onClick={() => {
                      setSettlementStaff(null);
                      setIsSettlementModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    New Settlement
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Staff Accounts Ledger Table */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  Staff Recovery Balances Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Live breakdown of cash in hand held by each staff member vs settled with Admin
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Total Recovered</th>
                    <th className="py-3 px-4 text-right">Total Handed Over</th>
                    <th className="py-3 px-4 text-right">Current In-Hand Cash</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {staff.map((st) => {
                    const bal = StorageService.getStaffCashBalance(st);
                    const hasCash = bal.inHandBalance > 0;

                    return (
                      <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-bold text-xs">
                              {st.name.charAt(0)}
                            </div>
                            <div>
                              <div>{st.name}</div>
                              <span className="text-[10px] text-slate-500 font-mono">{st.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 text-[11px] font-semibold">
                            {st.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                          Rs. {bal.totalCollected.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-400">
                          Rs. {bal.totalSettled.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                          <span className={hasCash ? 'text-emerald-400' : 'text-slate-400'}>
                            Rs. {bal.inHandBalance.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              hasCash
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {hasCash ? 'Cash In Hand' : 'Settled'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                             type="button"
                            onClick={() => {
                              setSettlementStaff(st);
                              setIsSettlementModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-black text-[11px] shadow-sm transition-all hover:scale-105"
                          >
                            Handover / Settle Cash &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Past Settlements History Table */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-400" />
              Settlement &amp; Cash Handover Ledger
            </h3>

            {settlements.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs italic">
                No cash handovers recorded yet. When staff hand over collected cash to Admin, the transaction will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Voucher #</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4 text-right">Amount Handed Over</th>
                      <th className="py-3 px-4">Channel / Mode</th>
                      <th className="py-3 px-4">Admin Receiver</th>
                      <th className="py-3 px-4">Remarks</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {s.date}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                          {s.reference || s.id}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {s.staffName}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                          Rs. {s.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-semibold">
                            {s.handoverMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {s.receivedBy}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[200px] truncate">
                          {s.notes || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPREHENSIVE ADD / EDIT STAFF MODAL WITH SECTION & FUNCTION BOXES */}
      {isFormModalOpen && (
        <Modal
          isOpen
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingStaff(null);
          }}
          title={editingStaff ? `Edit Staff Member: ${editingStaff.name}` : 'Add New Staff Member'}
          description="Set up credentials, tick allowed section boxes, and select operational function access"
          size="xl"
        >
            {/* Quick Presets Bar — sticky because the Modal body is one scroll
                container, so `shrink-0` alone had no effect. */}
            <div className="sticky top-0 z-10 py-3 px-4 my-3 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Role Presets (Auto-fill Boxes):
              </span>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('admin')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-bold transition-transform hover:scale-105"
                >
                  ðŸ‘‘ Admin (All Access)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('technician')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 font-bold transition-transform hover:scale-105"
                >
                  ðŸ”§ Field Technician
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('support')}
                  className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 font-bold transition-transform hover:scale-105"
                >
                  ðŸŽ§ Support Agent
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('accounts')}
                  className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 font-bold transition-transform hover:scale-105"
                >
                  ðŸ’° Accounts Officer
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-transform hover:scale-105"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" />
                  Clear All
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar — sticky, see the presets bar above. */}
            <div className="sticky top-[4.75rem] z-10 flex items-center gap-2 bg-slate-900 border-b border-slate-800 pb-2 mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'profile'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>1. Profile &amp; Login</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sections')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'sections'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2. Section Access Boxes</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'sections' ? 'bg-slate-950 text-cyan-300' : 'bg-slate-800 text-cyan-400'
                }`}>
                  {allowedSections.length}/{ALL_SECTIONS.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('functions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === 'functions'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>3. Working Permissions Boxes</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'functions' ? 'bg-slate-950 text-blue-300' : 'bg-slate-800 text-blue-400'
                }`}>
                  {allowedFunctions.length}/{ALL_FUNCTIONS.length}
                </span>
              </button>
            </div>

            {/* Form Body Scroll Area */}
            <form id="staff-modal-form" onSubmit={handleSaveStaff} className="flex-1 overflow-y-auto pr-1 space-y-5 text-xs">
              {/* TAB 1: BASIC PROFILE & LOGIN */}
              {activeTab === 'profile' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="full-name" className="block text-slate-300 font-bold mb-1.5">Full Name *</label>
                      <input
                         id="full-name"
                        type="text"
                        required
                        placeholder="e.g. Asim Munir"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label htmlFor="designation-role" className="block text-slate-300 font-bold mb-1.5">Designation / Role *</label>
                      <select
                         id="designation-role"
                        value={role}
                        onChange={(e) => {
                          const newRole = e.target.value as StaffMember['role'];
                          setRole(newRole);
                          // Auto prompt role preset suggestion
                          if (newRole === 'Admin') applyPreset('admin');
                          else if (newRole === 'Technician') applyPreset('technician');
                          else if (newRole === 'Support') applyPreset('support');
                          else if (newRole === 'Accounts') applyPreset('accounts');
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                      >
                        <option value="Technician">Field Technician / Lineman</option>
                        <option value="Support">Support &amp; Customer Care Agent</option>
                        <option value="Accounts">Accounts &amp; Cash Recovery Officer</option>
                        <option value="Manager">Operations Manager</option>
                        <option value="Admin">Admin (Full System Privilege)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="username" className="block text-slate-300 font-bold mb-1.5">Username (Login ID)</label>
                      <input
                         id="username"
                        type="text"
                        placeholder="e.g. asim_tech"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Can be used to login instead of full email</p>
                    </div>

                    <div>
                      <label htmlFor="phone-number" className="block text-slate-300 font-bold mb-1.5">Phone Number *</label>
                      <input
                         id="phone-number"
                        type="text"
                        required
                        placeholder="0300-1234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="email-address" className="block text-slate-300 font-bold mb-1.5">Email Address * (Primary Sign In)</label>
                      <input
                         id="email-address"
                        type="email"
                        required
                        placeholder="staff@trigonlinks.pk"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="staff-password"
                        className="block text-slate-300 font-bold mb-1.5 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5 text-cyan-400">
                          <Lock className="w-3.5 h-3.5" /> Staff Login Password
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Leave blank to keep the current one
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          id="staff-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Minimum 12 characters, mixed case and a number"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-cyan-700/80 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        The password is stored hashed by the account system and is never
                        written to this device. You can also let the server generate one
                        from the staff list.
                      </p>
                    </div>
                  </div>

                  {/* Coverage Areas Assignment */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <label className="block text-slate-300 font-bold mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        Assigned Coverage Areas (Optional)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {assignedAreaIds.length} of {areas.length} areas assigned
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                      {areas.map((a) => {
                        const isAssigned = assignedAreaIds.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => toggleArea(a.id)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              isAssigned
                                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            {isAssigned ? <Check className="w-3 h-3 text-cyan-400" /> : <Plus className="w-3 h-3 text-slate-600" />}
                            <span>{a.name}</span>
                          </button>
                        );
                      })}
                      {areas.length === 0 && (
                        <p className="text-slate-500 text-xs italic">No areas configured in database.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ALL SECTION ACCESS BOXES */}
              {activeTab === 'sections' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Select All Controls Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Section Access Permissions (Sidebar &amp; Navigation Modules)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tick the box for each section you want this staff member to see and access.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllSections}
                        className="px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-600/60 hover:bg-cyan-900 text-cyan-300 font-bold transition-all"
                      >
                        âœ“ Select All ({ALL_SECTIONS.length})
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllSections}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Grouped Section Checkbox Boxes */}
                  <div className="space-y-5">
                    {sectionGroups.map((groupName) => {
                      const groupSections = ALL_SECTIONS.filter((s) => s.group === groupName);
                      return (
                        <div key={groupName} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                              {groupName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {groupSections.filter((s) => allowedSections.includes(s.id)).length} of {groupSections.length} Enabled
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {groupSections.map((sec) => {
                              const isChecked = allowedSections.includes(sec.id);
                              const IconComponent = SECTION_ICON_MAP[sec.icon] || LayoutDashboard;

                              return (
                                <button
                                  key={sec.id}
                                  type="button"
                                  onClick={() => toggleSection(sec.id)}
                                  className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                                    isChecked
                                      ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/60 border-cyan-500/80 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-600" />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                                      <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-cyan-400' : 'text-slate-500'}`} />
                                      <span className="truncate">{sec.name}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                                      ID: {sec.id}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: ALL WORKING PERMISSIONS / FUNCTIONS BOXES */}
              {activeTab === 'functions' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Select All Controls Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-blue-400" />
                        Working Function Permissions (Actions &amp; Operations)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tick the box for every action (adding, deleting, billing, approvals) this staff member is allowed to perform.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllFunctions}
                        className="px-3 py-1.5 rounded-xl bg-blue-950 border border-blue-600/60 hover:bg-blue-900 text-blue-300 font-bold transition-all"
                      >
                        âœ“ Select All ({ALL_FUNCTIONS.length})
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllFunctions}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Functions Checkbox Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ALL_FUNCTIONS.map((fn) => {
                      const isChecked = allowedFunctions.includes(fn.id);
                      return (
                        <button
                          key={fn.id}
                          type="button"
                          onClick={() => toggleFunction(fn.id)}
                          className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                            isChecked
                              ? 'bg-gradient-to-r from-blue-950/80 to-indigo-950/60 border-blue-500/80 text-white shadow-md shadow-blue-950/40 ring-1 ring-blue-500/30'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-xs leading-snug flex items-center justify-between">
                              <span className={isChecked ? 'text-blue-300' : 'text-slate-300'}>
                                {fn.name}
                              </span>
                              {isChecked && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold">
                                  Allowed
                                </span>
                              )}
                            </h5>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {fn.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </form>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                {editingStaff && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(editingStaff)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 font-bold text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Staff Member
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeTab !== 'profile' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'functions' ? 'sections' : 'profile')}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}

                {activeTab !== 'functions' ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'profile' ? 'sections' : 'functions')}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-800/40"
                  >
                    Next Tab
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setIsFormModalOpen(false);
                    setEditingStaff(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="staff-modal-form"
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40 transition-all hover:scale-[1.02]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingStaff ? 'Save Changes & Access' : 'Create Staff Member'}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {staffToDelete && (
        <Modal
          isOpen
          onClose={() => setStaffToDelete(null)}
          title="Delete Staff Member?"
          description={`Are you sure you want to permanently delete ${staffToDelete.name} (${staffToDelete.role}) with email ${staffToDelete.email}?`}
          dismissible={false}
          footer={
            <>
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteStaff}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-950/50"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete Permanently
              </button>
            </>
          }
        >
          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 text-slate-400">
            <p>â€¢ All login credentials will be immediately revoked.</p>
            <p>â€¢ Access to all {staffToDelete.allowedSections?.length || 0} sections will be removed.</p>
            <p>â€¢ Record will be deleted from Appwrite Cloud &amp; local devices.</p>
          </div>
        </Modal>
      )}

      {/* QUICK PERMISSIONS MODAL */}
      {editingPermissionsStaff && (
        <PermissionsModal
          staff={editingPermissionsStaff}
          onClose={() => setEditingPermissionsStaff(null)}
          onSave={() => {
            refreshData();
          }}

        />
      )}

      {/* STAFF SETTLEMENT & CASH HANDOVER MODAL */}
      {isSettlementModalOpen && (
        <StaffSettlementModal
          initialStaff={settlementStaff}
          onClose={() => {
            setIsSettlementModalOpen(false);
            setSettlementStaff(null);
          }}
          onSuccess={() => {
            refreshData();
          }}

        />
      )}
      {/* ISSUED CREDENTIAL: shown once, never stored */}
      {issuedCredential && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIssuedCredential(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="issued-credential-title"
            className="bg-slate-900 border border-cyan-800/60 rounded-3xl w-full max-w-md shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="issued-credential-title" className="text-base font-black text-white">
              Password issued
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Copy it now. It is stored hashed by the account system and cannot be displayed
              again.
            </p>

            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-[10px] uppercase font-bold text-slate-500">Sign-in address</dt>
                <dd className="font-mono text-sm text-cyan-300 mt-0.5 break-all">
                  {issuedCredential.email}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase font-bold text-slate-500">Password</dt>
                <dd className="font-mono text-lg font-bold text-white mt-0.5 select-all break-all">
                  {issuedCredential.password}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Sign-in: ${issuedCredential.email}\nPassword: ${issuedCredential.password}`
                  );
                  showToast('success', 'Copied', 'Hand it over over a secure channel.');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-colors"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setIssuedCredential(null)}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


