import React, { useState, useEffect } from 'react';
import { ConnectionRequest, Customer, Area, CustomerInventoryItem } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollection, useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CustomerOnboardingSlipModal } from '../modals/CustomerOnboardingSlipModal';
import {
  GitPullRequest,
  Plus,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  MapPin,
  Phone,
  Eye,
  Edit,
  Trash2,
  RotateCcw,
  Printer,
  MessageCircle,
  DollarSign,
  Package,
  Layers,
  ShieldCheck,
  AlertTriangle,
  User,
  Zap,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const ConnectionsView: React.FC = () => {
  const { user, hasFunctionAccess, setActiveSection } = useAuth();
  const { showToast } = useToast();

  const [connections, refreshConnections] = useStorageCollection<ConnectionRequest[]>(
    () => StorageService.getConnections(),
    ['trigon_connections']
  );
  const [{ areas, packages, inventoryList }] = useStorageCollections({
    areas: () => StorageService.getAreas(),
    packages: () => StorageService.getPackages(),
    inventoryList: () => StorageService.getInventory(),
  });
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Modals
  const [viewingConn, setViewingConn] = useState<ConnectionRequest | null>(null);
  const [editingConn, setEditingConn] = useState<ConnectionRequest | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Onboarding Voucher Modal state (Auto Print & WhatsApp)
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipCustomer, setSlipCustomer] = useState<Customer | null>(null);
  const [slipConnection, setSlipConnection] = useState<ConnectionRequest | null>(null);

  // In-app modals for sandboxed actions
  const [rejectingConn, setRejectingConn] = useState<ConnectionRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('Feasibility issue / Area out of fiber coverage');
  const [deletingConn, setDeletingConn] = useState<ConnectionRequest | null>(null);

  // Form states for Add / Edit
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formAltMobile, setFormAltMobile] = useState('');
  const [formCnic, setFormCnic] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAreaId, setFormAreaId] = useState('');
  const [formPackageId, setFormPackageId] = useState('');
  const [formConnectionFee, setFormConnectionFee] = useState<number>(2500);
  const [formMonthlyFee, setFormMonthlyFee] = useState<number>(2500);
  
  // Discount states
  const [formDiscountType, setFormDiscountType] = useState<'none' | 'setup' | 'monthly' | 'both'>('none');
  const [formDiscountSetup, setFormDiscountSetup] = useState<number>(0);
  const [formDiscountMonthly, setFormDiscountMonthly] = useState<number>(0);
  const [formDiscountReason, setFormDiscountReason] = useState('');

  // Assigned Inventory
  const [formInventory, setFormInventory] = useState<CustomerInventoryItem[]>([]);
  const [selectedInvItemId, setSelectedInvItemId] = useState<string>('');
  const [selectedInvQty, setSelectedInvQty] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');

  // Refresh & timer ticker every second
  useEffect(() => {
    const ticker = setInterval(() => {
      setNowTimestamp(Date.now());
      // Re-fetch connections every 30s to trigger auto-purge of expired rejected items
      refreshConnections();
    }, 1000);

    return () => {
      clearInterval(ticker);
    };
  }, [refreshConnections]);

  // Open Add Modal
  const openAdd = () => {
    const defaultArea = areas[0]?.id || '';
    const defaultPkg = packages[0];
    setFormName('');
    setFormUsername(`user${Math.floor(100 + Math.random() * 900)}`);
    setFormFatherName('');
    setFormMobile('');
    setFormAltMobile('');
    setFormCnic('');
    setFormEmail('');
    setFormAddress('');
    setFormAreaId(defaultArea);
    setFormPackageId(defaultPkg?.id || '');
    setFormMonthlyFee(defaultPkg?.price || 2500);
    setFormConnectionFee(defaultPkg?.installationFee || 2500);
    setFormDiscountType('none');
    setFormDiscountSetup(0);
    setFormDiscountMonthly(0);
    setFormDiscountReason('');
    setFormInventory([]);
    setFormNotes('');
    setEditingConn(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEdit = (conn: ConnectionRequest) => {
    setEditingConn(conn);
    setFormName(conn.applicantName || conn.customerName || '');
    setFormUsername(conn.username || `user${Math.floor(100 + Math.random() * 900)}`);
    setFormFatherName(conn.fatherName || '');
    setFormMobile(conn.mobile || '');
    setFormAltMobile(conn.alternateMobile || '');
    setFormCnic(conn.cnic || '');
    setFormEmail(conn.email || '');
    setFormAddress(conn.address || '');
    setFormAreaId(conn.areaId || areas[0]?.id || '');
    setFormPackageId(conn.packageId || packages[0]?.id || '');
    setFormMonthlyFee(conn.monthlyFee || packages.find((p) => p.id === conn.packageId)?.price || 2500);
    setFormConnectionFee(conn.connectionFee || 2500);
    
    // Discounts
    const hasSetupDisc = (conn.discountSetup || 0) > 0;
    const hasMonthlyDisc = (conn.discountMonthly || 0) > 0;
    if (hasSetupDisc && hasMonthlyDisc) {
      setFormDiscountType('both');
    } else if (hasSetupDisc) {
      setFormDiscountType('setup');
    } else if (hasMonthlyDisc) {
      setFormDiscountType('monthly');
    } else {
      setFormDiscountType('none');
    }
    setFormDiscountSetup(conn.discountSetup || 0);
    setFormDiscountMonthly(conn.discountMonthly || 0);
    setFormDiscountReason(conn.discountReason || '');
    
    setFormInventory(conn.assignedInventory || []);
    setFormNotes(conn.notes || '');
    setIsAddModalOpen(true);
  };

  // Inventory Helper
  const handleAddInventoryItem = () => {
    if (!selectedInvItemId) return;
    const targetItem = inventoryList.find((i) => i.id === selectedInvItemId);
    if (!targetItem) return;

    const existingIdx = formInventory.findIndex((i) => i.itemId === selectedInvItemId);
    const qty = Number(selectedInvQty) || 1;
    const unitPrice = targetItem.sellingPrice || targetItem.price || targetItem.unitCost || 0;

    if (existingIdx >= 0) {
      const updated = [...formInventory];
      const newQty = updated[existingIdx].quantity + qty;
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: newQty,
        totalPrice: newQty * unitPrice,
      };
      setFormInventory(updated);
    } else {
      setFormInventory([
        ...formInventory,
        {
          itemId: targetItem.id,
          itemName: targetItem.name,
          quantity: qty,
          unitPrice,
          totalPrice: qty * unitPrice,
        },
      ]);
    }
    setSelectedInvItemId('');
    setSelectedInvQty(1);
  };

  const handleRemoveInventoryItem = (itemId: string) => {
    setFormInventory(formInventory.filter((i) => i.itemId !== itemId));
  };

  // Save Connection (Add or Edit)
  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formMobile.trim() || !formAreaId || !formPackageId) {
      showToast('error', 'Validation Failed', 'Please provide applicant name, mobile, area, and tariff package.');
      return;
    }

    const matchedArea = areas.find((a) => a.id === formAreaId);
    const matchedPkg = packages.find((p) => p.id === formPackageId);

    const effectiveSetupDisc = formDiscountType === 'setup' || formDiscountType === 'both' ? Number(formDiscountSetup) || 0 : 0;
    const effectiveMonthlyDisc = formDiscountType === 'monthly' || formDiscountType === 'both' ? Number(formDiscountMonthly) || 0 : 0;

    const netMonthly = Math.max(0, Number(formMonthlyFee) - effectiveMonthlyDisc);

    const connToSave: ConnectionRequest = {
      id: editingConn ? editingConn.id : `conn-${Date.now()}`,
      applicantName: formName.trim(),
      customerName: formName.trim(),
      username: formUsername.trim(),
      password: editingConn?.password || 'pass@123',
      fatherName: formFatherName.trim(),
      mobile: formMobile.trim(),
      alternateMobile: formAltMobile.trim(),
      email: formEmail.trim() || `${formUsername.trim()}@trigonlinks.pk`,
      cnic: formCnic.trim(),
      address: formAddress.trim(),
      areaId: formAreaId,
      areaName: matchedArea?.name || 'General Sector',
      packageId: formPackageId,
      packageName: matchedPkg?.name || 'Standard 20M',
      packageSpeed: matchedPkg?.speed || '20 Mbps',
      monthlyFee: Number(formMonthlyFee),
      connectionFee: Number(formConnectionFee),
      totalMonthly: netMonthly,
      discountSetup: effectiveSetupDisc,
      discountMonthly: effectiveMonthlyDisc,
      discountReason: formDiscountReason.trim(),
      discountType: formDiscountType === 'none' ? undefined : formDiscountType,
      assignedInventory: formInventory,
      status: editingConn ? editingConn.status : 'Pending',
      requestDate: editingConn?.requestDate || new Date().toISOString().split('T')[0],
      notes: formNotes.trim(),
      createdAt: editingConn?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageService.saveConnection(connToSave, user?.email);
    showToast(
      'success',
      editingConn ? 'Inquiry Updated' : 'Inquiry Submitted',
      editingConn
        ? `Changes saved for ${connToSave.applicantName}.`
        : `Connection inquiry for ${connToSave.applicantName} logged and routed for admin approval.`
    );
    setIsAddModalOpen(false);
    setEditingConn(null);
  };

  // 4 Core Action Handlers
  // 1. View
  const handleView = (conn: ConnectionRequest) => {
    setViewingConn(conn);
  };

  // 2. Edit -> openEdit(conn)

  // 3. Approve -> Converts to active Customer, saves to DB, opens Auto Print & WhatsApp modal!
  const handleApprove = (conn: ConnectionRequest) => {
    if (!hasFunctionAccess('approve_connections') && user?.role !== 'Admin') {
      showToast('denied', 'Access Denied', 'Your staff role does not have connection approval privileges.');
      return;
    }

    const matchedArea = areas.find((a) => a.id === conn.areaId);
    const matchedPkg = packages.find((p) => p.id === conn.packageId);
    const username = conn.username || `user${Math.floor(100 + Math.random() * 900)}`;

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: conn.applicantName || conn.customerName || 'Subscriber',
      username,
      fatherName: conn.fatherName || '',
      mobile: conn.mobile,
      alternateMobile: conn.alternateMobile || '',
      email: conn.email || `${username}@trigonlinks.pk`,
      cnic: conn.cnic || '',
      address: conn.address || '',
      landmark: conn.landmark || '',
      areaId: conn.areaId,
      areaName: conn.areaName || matchedArea?.name || 'General Sector',
      packageId: conn.packageId,
      packageName: conn.packageName || matchedPkg?.name || 'Standard Plan',
      packageSpeed: conn.packageSpeed || matchedPkg?.speed || '20 Mbps',
      monthlyFee: conn.monthlyFee || matchedPkg?.price || 2500,
      ipCharges: 0,
      iptvCharges: 0,
      connectionFee: conn.connectionFee || 2500,
      totalMonthly: conn.totalMonthly || (conn.monthlyFee || 2500) - (conn.discountMonthly || 0),
      installDate: new Date().toISOString().split('T')[0],
      billingDate: 1,
      discount: (conn.discountMonthly || 0) + (conn.discountSetup || 0),
      discountSetup: conn.discountSetup || 0,
      discountMonthly: conn.discountMonthly || 0,
      discountReason: conn.discountReason || '',
      discountType: conn.discountType,
      connectionType: conn.connectionType || 'Fiber',
      device: conn.device || 'Huawei HG8546M GPON ONT',
      opticalPowerDbm: conn.opticalPowerDbm || -19.4,
      cableLengthMeters: conn.cableLengthMeters || 120,
      splitterPort: conn.splitterPort || 'FDT-03 / Port 7',
      pppoeUsername: conn.pppoeUsername || username,
      pppoePassword: conn.pppoePassword || conn.password || 'pass@123',
      ipAddress: conn.ipAddress || `192.168.10.${Math.floor(10 + Math.random() * 80)}`,
      status: 'Active',
      walletBalance: 0,
      pendingBalance: 0,
      assignedInventory: conn.assignedInventory || [],
      notes: conn.notes || 'Onboarded via connection approval.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save as formal customer
    StorageService.saveCustomer(newCustomer, user?.email);
    // Mark connection request as Approved
    StorageService.updateConnectionStatus(conn.id, 'Approved', user?.email);

    showToast(
      'success',
      'Connection Approved & Subscriber Created',
      `Approved ${newCustomer.name}. Customer record is now active in database!`
    );

    // Automatically trigger Onboarding Voucher Slip & WhatsApp Modal
    setSlipCustomer(newCustomer);
    setSlipConnection(conn);
    setSlipModalOpen(true);
  };

  // 4. Reject -> Opens reject confirmation dialog
  const handleReject = (conn: ConnectionRequest) => {
    setRejectingConn(conn);
    setRejectReason('Feasibility issue / Area out of fiber coverage');
  };

  const confirmReject = () => {
    if (!rejectingConn) return;
    StorageService.updateConnectionStatus(
      rejectingConn.id,
      'Rejected',
      user?.email,
      rejectReason.trim() || 'Declined by Administrator'
    );
    showToast(
      'warning',
      'Inquiry Rejected (24h Timer Active)',
      `Request marked rejected. 24-hour grace period started. You can undo/re-approve or delete immediately.`
    );
    setRejectingConn(null);
  };

  // Undo Rejection (Re-Approve within 24 hours)
  const handleUndoRejection = (conn: ConnectionRequest) => {
    handleApprove(conn);
  };

  // Fori Delete (Immediate permanent delete)
  const handleImmediateDelete = (conn: ConnectionRequest) => {
    setDeletingConn(conn);
  };

  const confirmImmediateDelete = () => {
    if (!deletingConn) return;
    StorageService.deleteConnection(deletingConn.id, user?.email);
    showToast('success', 'Deleted Immediately', `Inquiry record permanently purged.`);
    setDeletingConn(null);
  };

  // Calculate 24-hour remaining countdown
  const getRemainingTime = (rejectedAt?: string) => {
    if (!rejectedAt) return null;
    const rejectTime = new Date(rejectedAt).getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const expiryTime = rejectTime + twentyFourHoursMs;
    const remainingMs = expiryTime - nowTimestamp;

    if (remainingMs <= 0) return 'Expired (Auto-Purging)';

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Filter connections
  const filtered = connections.filter((c) => {
    const name = c.applicantName || c.customerName || '';
    const cnic = c.cnic || '';
    const phone = c.mobile || '';
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      cnic.includes(search);

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && c.status === statusFilter;
  });

  const pendingCount = connections.filter((c) => c.status === 'Pending').length;
  const rejectedCount = connections.filter((c) => c.status === 'Rejected').length;
  const approvedCount = connections.filter((c) => c.status === 'Approved' || c.status === 'Completed').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-cyan-400" />
            Connection Onboarding &amp; Verification Hub
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Incoming subscriber applications, dual-control approval pipeline, 24-hr rejection grace timers &amp; instant voucher printing
          </p>
        </div>

        <button
           type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
        >
          <Plus className="w-4 h-4" />
          + New Connection Inquiry
        </button>
      </div>

      {/* KPI Status Badges Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <button
           type="button"
          onClick={() => setStatusFilter('All')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'All'
              ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase">All Inquiries</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1">{connections.length}</p>
          <span className="text-[10px] text-slate-500">Total pipeline records</span>
        </button>

        <button
           type="button"
          onClick={() => setStatusFilter('Pending')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'Pending'
              ? 'bg-amber-950/50 border-amber-500 text-white shadow-lg shadow-amber-950/40'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-amber-400">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1">{pendingCount}</p>
          <span className="text-[10px] text-amber-400 font-semibold">Requires admin approval</span>
        </button>

        <button
           type="button"
          onClick={() => setStatusFilter('Approved')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'Approved'
              ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-emerald-400">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1">{approvedCount}</p>
          <span className="text-[10px] text-emerald-400">Converted to subscribers</span>
        </button>

        <button
           type="button"
          onClick={() => setStatusFilter('Rejected')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            statusFilter === 'Rejected'
              ? 'bg-rose-950/50 border-rose-500 text-white shadow-lg shadow-rose-950/40'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-rose-400">Rejected (24h Timer)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1">{rejectedCount}</p>
          <span className="text-[10px] text-rose-400">Auto-purge active</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search applicant name, phone, CNIC, sector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-slate-400 font-semibold">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="All">All Inquiries ({connections.length})</option>
            <option value="Pending">Pending Approval ({pendingCount})</option>
            <option value="Approved">Approved Subscribed ({approvedCount})</option>
            <option value="Rejected">Rejected &bull; 24h Timer ({rejectedCount})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Applicant &amp; Account</th>
                <th className="py-3.5 px-4">Contact &amp; CNIC</th>
                <th className="py-3.5 px-4">Zone &amp; Address</th>
                <th className="py-3.5 px-4">Plan &amp; Tariffs</th>
                <th className="py-3.5 px-4">Discounts</th>
                <th className="py-3.5 px-4 text-center">Status / Timer</th>
                <th className="py-3.5 px-4 text-right">Actions (4 Controls)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((conn) => {
                const remaining = conn.status === 'Rejected' ? getRemainingTime(conn.rejectedAt) : null;
                const netMonthly = Math.max(0, (conn.monthlyFee || 2500) - (conn.discountMonthly || 0));

                return (
                  <tr key={conn.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Applicant */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white text-sm">{conn.applicantName || conn.customerName}</p>
                      <p className="text-[11px] font-mono text-cyan-400">@{conn.username || 'user'}</p>
                    </td>

                    {/* Contact & CNIC */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-200 font-mono font-medium">{conn.mobile}</p>
                      <p className="text-[11px] font-mono text-slate-400">CNIC: {conn.cnic || '—'}</p>
                    </td>

                    {/* Zone & Address */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-200 font-bold">{conn.areaName}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{conn.address}</p>
                    </td>

                    {/* Plan & Tariffs */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-semibold block w-fit">
                        {conn.packageName}
                      </span>
                      <p className="text-[11px] font-mono text-emerald-400 mt-1 font-bold">
                        Net: Rs. {netMonthly.toLocaleString()}/mo
                      </p>
                    </td>

                    {/* Discounts */}
                    <td className="py-3.5 px-4">
                      {(conn.discountSetup || 0) > 0 || (conn.discountMonthly || 0) > 0 ? (
                        <div className="space-y-0.5">
                          {(conn.discountSetup || 0) > 0 && (
                            <span className="block px-2 py-0.5 rounded bg-purple-950 text-purple-300 text-[10px] font-bold border border-purple-800 w-fit">
                              Setup: -Rs. {conn.discountSetup?.toLocaleString()}
                            </span>
                          )}
                          {(conn.discountMonthly || 0) > 0 && (
                            <span className="block px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] font-bold border border-indigo-800 w-fit">
                              Monthly: -Rs. {conn.discountMonthly?.toLocaleString()}
                            </span>
                          )}
                          {conn.discountReason && (
                            <p className="text-[10px] text-slate-400 italic truncate max-w-[120px]">
                              {conn.discountReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </td>

                    {/* Status & 24h Timer */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            conn.status === 'Approved'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : conn.status === 'Rejected'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                          }`}
                        >
                          {conn.status}
                        </span>

                        {/* 24-HOUR COUNTDOWN TIMER */}
                        {conn.status === 'Rejected' && remaining && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-800/80">
                            <Clock className="w-3 h-3 text-rose-400 shrink-0 animate-spin" />
                            <span>{remaining}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 4 ACTION BUTTONS: 1. View, 2. Edit, 3. Approve, 4. Reject */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* 1. VIEW BUTTON */}
                        <button
                           type="button"
                          onClick={() => handleView(conn)}
                          title="View Full Application Dossier"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* 2. EDIT BUTTON */}
                        <button
                           type="button"
                          onClick={() => openEdit(conn)}
                          title="Edit Connection Details & Pricing"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* If Pending: Show Approve & Reject */}
                        {conn.status === 'Pending' && (
                          <>
                            {/* 3. APPROVE BUTTON */}
                            <button
                               type="button"
                              onClick={() => handleApprove(conn)}
                              title="Approve & Activate Customer Record"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-black text-[11px] shadow-sm transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>

                            {/* 4. REJECT BUTTON */}
                            <button
                               type="button"
                              onClick={() => handleReject(conn)}
                              title="Reject (Starts 24h grace timer)"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-700 text-rose-300 font-black text-[11px] shadow-sm transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </>
                        )}

                        {/* If Rejected: Show Re-Approve (Undo) & Immediate Delete */}
                        {conn.status === 'Rejected' && (
                          <>
                            {/* Re-approve / Undo Rejection within 24h */}
                            <button
                               type="button"
                              onClick={() => handleUndoRejection(conn)}
                              title="Undo Rejection & Approve to Customer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-[10px]"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Re-Approve
                            </button>

                            {/* Immediate Delete ("Fori Delete") */}
                            <button
                               type="button"
                              onClick={() => handleImmediateDelete(conn)}
                              title="Delete Permanently Right Now (Fori Delete)"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-900 hover:bg-rose-800 border border-rose-600 text-white font-bold text-[10px]"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete Now
                            </button>
                          </>
                        )}

                        {/* If Approved: Allow Re-Printing Voucher / Slip */}
                        {conn.status === 'Approved' && (
                          <button
                             type="button"
                            onClick={() => {
                              setSlipConnection(conn);
                              setSlipModalOpen(true);
                            }}
                            title="Print Onboarding Slip / WhatsApp Dispatch"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-bold text-[11px]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Voucher
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <GitPullRequest className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-bold text-sm text-slate-300">No Connection Inquiries Found</p>
                    <p className="text-xs text-slate-500 mt-0.5">Try modifying your search or filter tab.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. VIEW DOSSIER MODAL */}
      {viewingConn && (
        <Modal
          isOpen
          onClose={() => setViewingConn(null)}
          title={viewingConn.applicantName || viewingConn.customerName || ''}
          description={`Username: @${viewingConn.username || 'user'} • Status: ${viewingConn.status}`}
          size="lg"
        >
          <div className="mb-6">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
          </div>

            {/* Boxes of Information */}
            <div className="space-y-4 text-xs">
              {/* Box 1: Personal & Identity */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Box 1: Subscriber Identity &amp; Contact
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Mobile Phone:</span>
                    <span className="font-mono font-bold text-white">{viewingConn.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CNIC Number:</span>
                    <span className="font-mono text-white">{viewingConn.cnic || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Father Name:</span>
                    <span className="text-white">{viewingConn.fatherName || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px]">Coverage Zone &amp; Address:</span>
                    <span className="text-white">{viewingConn.areaName} &mdash; {viewingConn.address}</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Tariff & Pricing */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  Box 2: Tariff Package &amp; Financials
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Package:</span>
                    <span className="font-bold text-white">{viewingConn.packageName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Monthly Fee:</span>
                    <span className="font-mono font-bold text-white">Rs. {(viewingConn.monthlyFee || 2500).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Monthly Discount:</span>
                    <span className="font-mono text-emerald-400 font-bold">-Rs. {(viewingConn.discountMonthly || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Net Monthly Bill:</span>
                    <span className="font-mono text-cyan-400 font-black">
                      Rs. {Math.max(0, (viewingConn.monthlyFee || 2500) - (viewingConn.discountMonthly || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Setup Fee:</span>
                    <span className="font-mono text-white">Rs. {(viewingConn.connectionFee || 2500).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Setup Discount:</span>
                    <span className="font-mono text-purple-400 font-bold">-Rs. {(viewingConn.discountSetup || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Reason:</span>
                    <span className="text-slate-300 italic">{viewingConn.discountReason || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Assigned Inventory */}
              {viewingConn.assignedInventory && viewingConn.assignedInventory.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    Box 3: Assigned Equipment &amp; Hardware
                  </span>
                  <div className="divide-y divide-slate-800/80 font-mono">
                    {viewingConn.assignedInventory.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between">
                        <span className="font-sans text-slate-200">{item.itemName} (x{item.quantity})</span>
                        <span className="text-slate-300 font-bold">Rs. {(item.totalPrice || item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action row in View modal */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                <button
                   type="button"
                  onClick={() => setViewingConn(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                     type="button"
                    onClick={() => {
                      const c = viewingConn;
                      setViewingConn(null);
                      openEdit(c);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-300 font-bold flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>

                  {viewingConn.status === 'Pending' && (
                    <button
                       type="button"
                      onClick={() => {
                        const c = viewingConn;
                        setViewingConn(null);
                        handleApprove(c);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve Connection
                    </button>
                  )}
                </div>
              </div>
            </div>
        </Modal>
      )}

      {/* 2. ADD / EDIT CONNECTION MODAL */}
      {isAddModalOpen && (
        <Modal
          isOpen
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingConn(null);
          }}
          title={editingConn ? 'Edit Subscriber Connection Inquiry' : 'Log New Subscriber Connection Inquiry'}
          description="Specify applicant profile, tariff package, first-time setup or monthly discounts, and hardware inventory."
          size="lg"
        >
          <form onSubmit={handleSaveConnection} className="space-y-4 text-xs">
              {/* Box A: Identity */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                  1. Applicant Identity &amp; Contact
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="applicant-name" className="block text-slate-300 font-bold mb-1">Applicant Name *</label>
                    <input
                       id="applicant-name"
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Kamran Malik"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="pppoe-account-username" className="block text-slate-300 font-bold mb-1">PPPoE / Account Username *</label>
                    <input
                       id="pppoe-account-username"
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                      placeholder="kamran.malik"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="mobile-phone" className="block text-slate-300 font-bold mb-1">Mobile Phone *</label>
                    <input
                       id="mobile-phone"
                      type="text"
                      required
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="cnic-number" className="block text-slate-300 font-bold mb-1">CNIC Number</label>
                    <input
                       id="cnic-number"
                      type="text"
                      value={formCnic}
                      onChange={(e) => setFormCnic(e.target.value)}
                      placeholder="35201-1234567-1"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="father-name" className="block text-slate-300 font-bold mb-1">Father Name</label>
                    <input
                       id="father-name"
                      type="text"
                      value={formFatherName}
                      onChange={(e) => setFormFatherName(e.target.value)}
                      placeholder="e.g. Muhammad Aslam"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="coverage-area-sector" className="block text-slate-300 font-bold mb-1">Coverage Area / Sector *</label>
                    <select
                       id="coverage-area-sector"
                      value={formAreaId}
                      onChange={(e) => setFormAreaId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    >
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({(a as any).sectorCode || a.code || 'Sector'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="full-installation-address" className="block text-slate-300 font-bold mb-1">Full Installation Address</label>
                    <input
                       id="full-installation-address"
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Street #4, House #12, Near Jamia Masjid"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Box B: Package & Discounts */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                  2. Tariff Package, Connection Fee &amp; Discounts
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="select-package" className="block text-slate-300 font-bold mb-1">Select Package *</label>
                    <select
                       id="select-package"
                      value={formPackageId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setFormPackageId(pid);
                        const matched = packages.find((p) => p.id === pid);
                        if (matched) {
                          setFormMonthlyFee(matched.price);
                          if (matched.installationFee) setFormConnectionFee(matched.installationFee);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    >
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.speed}) - Rs. {pkg.price}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="base-monthly-fee" className="block text-slate-300 font-bold mb-1">Base Monthly Fee (PKR)</label>
                    <input
                       id="base-monthly-fee"
                      type="number"
                      value={formMonthlyFee}
                      onChange={(e) => setFormMonthlyFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="connection-setup-fee" className="block text-slate-300 font-bold mb-1">Connection / Setup Fee (PKR)</label>
                    <input
                       id="connection-setup-fee"
                      type="number"
                      value={formConnectionFee}
                      onChange={(e) => setFormConnectionFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>

                {/* TWO DISTINCT DISCOUNT TYPES (EXPLICIT USER REQUIREMENT) */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-cyan-300 font-bold mb-1 text-[11px]">
                      Discount Application Scope
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormDiscountType('none');
                          setFormDiscountSetup(0);
                          setFormDiscountMonthly(0);
                        }}
                        className={`py-1.5 px-2 rounded-lg font-bold text-center border transition-all ${
                          formDiscountType === 'none'
                            ? 'bg-slate-800 text-white border-slate-600'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        No Discount
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormDiscountType('setup')}
                        className={`py-1.5 px-2 rounded-lg font-bold text-center border transition-all ${
                          formDiscountType === 'setup'
                            ? 'bg-purple-950 text-purple-200 border-purple-600'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Setup Fee Only
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormDiscountType('monthly')}
                        className={`py-1.5 px-2 rounded-lg font-bold text-center border transition-all ${
                          formDiscountType === 'monthly'
                            ? 'bg-emerald-950 text-emerald-200 border-emerald-600'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Monthly Bill Only
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormDiscountType('both')}
                        className={`py-1.5 px-2 rounded-lg font-bold text-center border transition-all ${
                          formDiscountType === 'both'
                            ? 'bg-cyan-950 text-cyan-200 border-cyan-600'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Both (Setup + Monthly)
                      </button>
                    </div>
                  </div>

                  {formDiscountType !== 'none' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                      {(formDiscountType === 'setup' || formDiscountType === 'both') && (
                        <div>
                          <label htmlFor="first-time-setup-discount" className="block text-purple-300 font-bold mb-1">
                            First-Time Setup Discount (PKR)
                          </label>
                          <input
                             id="first-time-setup-discount"
                            type="number"
                            value={formDiscountSetup}
                            onChange={(e) => setFormDiscountSetup(Number(e.target.value))}
                            placeholder="e.g. 500"
                            className="w-full px-3 py-2 bg-slate-950 border border-purple-800 rounded-xl text-white focus:outline-none focus:border-purple-400 font-mono"
                          />
                        </div>
                      )}

                      {(formDiscountType === 'monthly' || formDiscountType === 'both') && (
                        <div>
                          <label htmlFor="monthly-bill-recurring-discount" className="block text-emerald-300 font-bold mb-1">
                            Monthly Bill Recurring Discount (PKR)
                          </label>
                          <input
                             id="monthly-bill-recurring-discount"
                            type="number"
                            value={formDiscountMonthly}
                            onChange={(e) => setFormDiscountMonthly(Number(e.target.value))}
                            placeholder="e.g. 300"
                            className="w-full px-3 py-2 bg-slate-950 border border-emerald-800 rounded-xl text-white focus:outline-none focus:border-emerald-400 font-mono"
                          />
                        </div>
                      )}

                      <div className={formDiscountType === 'both' ? 'col-span-1' : 'col-span-2'}>
                        <label htmlFor="discount-justification-reason" className="block text-slate-300 font-bold mb-1">
                          Discount Justification / Reason *
                        </label>
                        <input
                           id="discount-justification-reason"
                          type="text"
                          value={formDiscountReason}
                          onChange={(e) => setFormDiscountReason(e.target.value)}
                          placeholder="e.g. Special Launch Offer, Advance 1-Year Payment"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Live Calculation Preview Banner */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Net Monthly Bill:</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        Rs. {Math.max(0, formMonthlyFee - (formDiscountType === 'monthly' || formDiscountType === 'both' ? formDiscountMonthly : 0)).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Net Setup Fee Due:</span>
                      <span className="text-base font-black text-purple-400 font-mono">
                        Rs. {Math.max(0, formConnectionFee - (formDiscountType === 'setup' || formDiscountType === 'both' ? formDiscountSetup : 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box C: Hardware Inventory Assignment */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                  3. Assign Hardware &amp; Installation Materials (Auto Pricing)
                </span>

                <div className="flex gap-2">
                  <select
                    value={selectedInvItemId}
                    onChange={(e) => setSelectedInvItemId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">-- Choose Inventory Item --</option>
                    {inventoryList.map((item) => {
                      const p = item.sellingPrice || item.price || item.unitCost || 0;
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name} (Stock: {item.quantity} {item.unit || 'pcs'}) - Rs. {p.toLocaleString()}
                        </option>
                      );
                    })}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={selectedInvQty}
                    onChange={(e) => setSelectedInvQty(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-center"
                    placeholder="Qty"
                  />

                  <button
                    type="button"
                    onClick={handleAddInventoryItem}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                  >
                    + Add
                  </button>
                </div>

                {/* Assigned Items List */}
                {formInventory.length > 0 && (
                  <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
                    {formInventory.map((item) => (
                      <div key={item.itemId} className="p-2.5 flex items-center justify-between text-xs bg-slate-900/60">
                        <div>
                          <span className="font-bold text-white">{item.itemName}</span>
                          <span className="text-slate-400 ml-2 font-mono">
                            {item.quantity} x Rs. {item.unitPrice} = Rs. {item.totalPrice}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveInventoryItem(item.itemId)}
                          className="text-rose-400 hover:text-rose-300 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box D: Notes */}
              <div>
                <label htmlFor="survey-administrative-notes" className="block text-slate-300 font-bold mb-1">Survey / Administrative Notes</label>
                <textarea
                   id="survey-administrative-notes"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Field survey done, 120m drop cable required from FDT-03 port 4"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Bottom Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingConn(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40"
                >
                  {editingConn ? 'Save Changes' : 'Submit Connection Application'}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* 3. ONBOARDING VOUCHER SLIP & WHATSAPP MODAL (Auto Print & Msg) */}
      <CustomerOnboardingSlipModal
        isOpen={slipModalOpen}
        customer={slipCustomer}
        connection={slipConnection}
        onClose={() => {
          setSlipModalOpen(false);
          setSlipCustomer(null);
          setSlipConnection(null);
        }}
        autoPrint={true}
      />

      {/* 4. REJECT REASON MODAL */}
      {rejectingConn && (
        <Modal
          isOpen
          onClose={() => setRejectingConn(null)}
          title="⚠️ Reject Connection Inquiry"
          description={`Rejecting inquiry for ${rejectingConn.applicantName || rejectingConn.customerName || ''} will activate a 24-hour grace period timer.`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRejectingConn(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black"
              >
                Confirm Rejection
              </button>
            </>
          }
        >
          <div>
            <label htmlFor="reason-for-rejection" className="block text-xs font-bold text-slate-300 mb-1">Reason for Rejection *</label>
            <input
               id="reason-for-rejection"
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Feasibility issue, Area out of coverage"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
        </Modal>
      )}

      {/* 5. IMMEDIATE DELETE CONFIRMATION MODAL */}
      {deletingConn && (
        <Modal
          isOpen
          onClose={() => setDeletingConn(null)}
          title="🗑️ Delete Connection Inquiry"
          description={`Are you sure you want to permanently delete the connection request for ${deletingConn.applicantName || deletingConn.customerName || ''} immediately? This action cannot be undone.`}
          dismissible={false}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeletingConn(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImmediateDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black"
              >
                Delete Permanently
              </button>
            </>
          }
        >
          <></>
        </Modal>
      )}
    </div>
  );
};
