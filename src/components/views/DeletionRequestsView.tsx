import React, { useState } from 'react';
import { DeletionRequest, Customer, Package } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  Trash2,
  Plus,
  Send,
  UserX,
  AlertTriangle,
  Calendar,
  User,
  FileText,
  Filter,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const DeletionRequestsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  // Modal for creating new approval request
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [entityType, setEntityType] = useState<'Customer' | 'Staff' | 'Connection' | 'Package'>('Customer');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('Customer shifted / cancelled subscription');
  const [notes, setNotes] = useState('');

  // Lists for dropdown selection
  const [
    { requests, customers, staffList, connections, packages },
    refreshData,
  ] = useStorageCollections({
    requests: () => StorageService.getDeletionRequests(),
    customers: () => StorageService.getCustomers(),
    staffList: () => StorageService.getStaff(),
    connections: () => StorageService.getConnections(),
    packages: () => StorageService.getPackages(),
  });

  const handleApprove = (req: DeletionRequest) => {
    // Approving permanently purges a subscriber, staff member, connection or
    // package. The whole point of this queue is that it is privileged, so it
    // is restricted to administrators rather than to anyone with section access.
    if (!isAdmin) {
      showToast(
        'error',
        'Administrator access required',
        'Only a Super Admin can approve a deletion. Ask an administrator to review it.'
      );
      return;
    }
    StorageService.resolveDeletionRequest(req.id, 'Approved', user?.email);
    showToast(
      'success',
      'Deletion Approved & Purged',
      `Record "${req.targetName || req.entityTitle}" has been permanently purged from database.`
    );
    refreshData();
  };

  const handleReject = (req: DeletionRequest) => {
    if (!isAdmin) {
      showToast(
        'error',
        'Administrator access required',
        'Only a Super Admin can decide a deletion request.'
      );
      return;
    }
    StorageService.resolveDeletionRequest(req.id, 'Rejected', user?.email);
    showToast(
      'warning',
      'Deletion Rejected',
      `Request to delete "${req.targetName || req.entityTitle || 'Record'}" was declined.`
    );
    refreshData();
  };

  const handleDeleteRequestLog = (reqId: string) => {
    StorageService.deleteDeletionRequest(reqId);
    showToast('info', 'Request Log Removed', 'The deletion request entry has been dismissed.');
    refreshData();
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      showToast('error', 'Select Record', 'Please choose the specific record to request deletion for.');
      return;
    }

    let targetTitle = targetId;
    if (entityType === 'Customer') {
      const c = customers.find((x) => x.id === targetId);
      if (c) targetTitle = `${c.name} (${c.username})`;
    } else if (entityType === 'Staff') {
      const s = staffList.find((x) => x.id === targetId);
      if (s) targetTitle = `${s.name} (${s.role})`;
    } else if (entityType === 'Connection') {
      const conn = connections.find((x) => x.id === targetId);
      if (conn) targetTitle = `${conn.customerName || conn.applicantName} (${conn.mobile})`;
    } else if (entityType === 'Package') {
      const p = packages.find((x) => x.id === targetId);
      if (p) targetTitle = `${p.name} (${p.speedMbps} Mbps)`;
    }

    const fullReason = notes.trim() ? `${reason} - ${notes.trim()}` : reason;

    StorageService.requestDeletion(
      entityType,
      targetId,
      targetTitle,
      user?.name || user?.email || 'Admin',
      fullReason
    );

    showToast(
      'success',
      'Approval Request Submitted',
      `Deletion request for ${targetTitle} placed in Admin Approvals queue.`
    );

    setIsCreateModalOpen(false);
    setTargetId('');
    setNotes('');
    refreshData();
  };

  const filtered = requests.filter((r) => {
    const tName = r.targetName || r.entityTitle || '';
    const rName = r.requestedByName || r.requestedBy || '';
    const rReason = r.reason || '';
    const matchesSearch =
      tName.toLowerCase().includes(search.toLowerCase()) ||
      rName.toLowerCase().includes(search.toLowerCase()) ||
      rReason.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'Rejected').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
              Dual-Control Deletion Approvals
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 font-bold uppercase tracking-wider">
              Admin Approval Queue
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Super Admin verification queue for subscriber terminations, hardware purges, and record deletions
          </p>
        </div>

        {isAdmin ? (
          <button
             type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/40 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            + New Deletion Request
          </button>
        ) : (
          <p className="text-[11px] text-slate-400 w-full sm:w-auto text-right sm:text-left">
            Approving a request permanently deletes a record, so it is limited to Super Admins.
            You can review this queue but not action it.
          </p>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Requests</span>
          <span className="text-xl font-black text-white font-mono mt-0.5 block">{requests.length}</span>
          <span className="text-[10px] text-slate-500">All recorded audit items</span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 shadow-sm">
          <span className="text-[10px] text-amber-300 uppercase font-bold block flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending Approvals
          </span>
          <span className="text-2xl font-black text-amber-400 font-mono mt-0.5 block">{pendingCount}</span>
          <span className="text-[10px] text-amber-400/70">Awaiting Admin decision</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 shadow-sm">
          <span className="text-[10px] text-emerald-300 uppercase font-bold block flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved &amp; Purged
          </span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">{approvedCount}</span>
          <span className="text-[10px] text-emerald-400/70">Permanently deleted</span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 shadow-sm">
          <span className="text-[10px] text-rose-300 uppercase font-bold block flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Rejected Requests
          </span>
          <span className="text-2xl font-black text-rose-400 font-mono mt-0.5 block">{rejectedCount}</span>
          <span className="text-[10px] text-rose-400/70">Declined by Admin</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records, staff, reasons, dates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
          />
        </div>

        {/* Status Filter Tabs (Scrollable on small mobile) */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
            <button
               type="button"
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* RESPONSIVE CARDS VIEW FOR MOBILE / SMALL SCREENS */}
      <div className="block md:hidden space-y-3">
        {filtered.map((req) => (
          <div
            key={req.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase font-bold">
                  {req.targetType || req.entityType}
                </span>
                <h4 className="font-bold text-white text-sm mt-1">
                  {req.targetName || req.entityTitle}
                </h4>
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                  req.status === 'Approved'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : req.status === 'Rejected'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                }`}
              >
                {req.status}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Requested by: <strong className="text-slate-200">{req.requestedByName || req.requestedBy}</strong></span>
              </div>
              <div className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono">{req.requestedAt || req.createdAt}</span>
              </div>
              <div className="text-slate-300 pt-1 border-t border-slate-900 font-medium">
                Reason: {req.reason}
              </div>
            </div>

            {/* Actions for Mobile */}
            <div className="pt-1 flex items-center gap-2">
              {req.status === 'Pending' ? (
                <>
                  <button
                     type="button"
                    onClick={() => handleApprove(req)}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve &amp; Purge
                  </button>
                  <button
                     type="button"
                    onClick={() => handleReject(req)}
                    className="py-2 px-3 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-between text-xs text-slate-500">
                  <span>{req.status} by {req.reviewedBy?.split('@')[0] || 'Admin'}</span>
                  <button
                     type="button"
                    onClick={() => handleDeleteRequestLog(req.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:text-rose-400 text-slate-400"
                    title="Dismiss"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No deletion requests match the filter.
          </div>
        )}
      </div>

      {/* FULL DATA TABLE FOR TABLET & DESKTOP */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Entity Type</th>
                <th className="py-3.5 px-4">Target Record</th>
                <th className="py-3.5 px-4">Requested By</th>
                <th className="py-3.5 px-4">Reason for Termination</th>
                <th className="py-3.5 px-4">Requested Date</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Admin Decision / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase font-bold">
                      {req.targetType || req.entityType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white text-sm">
                    {req.targetName || req.entityTitle}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {req.requestedByName || req.requestedBy}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 max-w-xs leading-relaxed">
                    {req.reason}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {req.requestedAt || req.createdAt}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        req.status === 'Approved'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : req.status === 'Rejected'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {req.status === 'Pending' ? (
                        <>
                          <button
                             type="button"
                            onClick={() => handleApprove(req)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-sm transition-all hover:scale-105"
                            title="Approve and permanently purge record"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; Purge
                          </button>
                          <button
                             type="button"
                            onClick={() => handleReject(req)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold text-xs transition-colors"
                            title="Reject deletion request"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {req.status} by {req.reviewedBy?.split('@')[0] || 'Admin'}
                          </span>
                          <button
                             type="button"
                            onClick={() => handleDeleteRequestLog(req.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Clear request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                    No deletion requests match the current search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE APPROVAL REQUEST */}
      {isCreateModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Deletion Approval Request"
          description="Submit record for dual-control Super Admin verification"
        >
          <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label htmlFor="select-entity-type" className="block text-slate-300 font-bold mb-1.5">Select Entity Type *</label>
                <select
                   id="select-entity-type"
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value as any);
                    setTargetId('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="Customer">Customer / Subscriber</option>
                  <option value="Connection">Connection Request</option>
                  <option value="Staff">Staff Member</option>
                  <option value="Package">Package / Tariff Plan</option>
                </select>
              </div>

              <div>
                <label htmlFor="select-specific-record" className="block text-slate-300 font-bold mb-1.5">Select Specific Record *</label>
                <select
                   id="select-specific-record"
                  value={targetId}
                  required
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Choose {entityType} to Delete --</option>
                  {entityType === 'Customer' &&
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.username}) &bull; {c.packageName} &bull; {c.areaName}
                      </option>
                    ))}
                  {entityType === 'Connection' &&
                    connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customerName || c.applicantName} ({c.mobile}) &bull; Status: {c.status}
                      </option>
                    ))}
                  {entityType === 'Staff' &&
                    staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role}) &bull; {s.email}
                      </option>
                    ))}
                  {entityType === 'Package' &&
                    packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.speedMbps} Mbps) &bull; Rs. {p.price}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="reason-for-deletion" className="block text-slate-300 font-bold mb-1.5">Reason for Deletion *</label>
                <select
                   id="reason-for-deletion"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="Customer shifted / cancelled subscription">Customer shifted / cancelled subscription</option>
                  <option value="ONT hardware returned & surrendered to office">ONT hardware returned & surrendered to office</option>
                  <option value="Persistent non-payment default and arrears">Persistent non-payment default and arrears</option>
                  <option value="Duplicate or test entry cleanup">Duplicate or test entry cleanup</option>
                  <option value="Staff resignation or termination">Staff resignation or termination</option>
                  <option value="Obsolete package plan">Obsolete package plan</option>
                  <option value="Other Custom Reason">Other Custom Reason</option>
                </select>
              </div>

              <div>
                <label htmlFor="additional-notes" className="block text-slate-300 font-bold mb-1">Additional Notes</label>
                <textarea
                   id="additional-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Audit justification, equipment status, remarks..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-md transition-all"
                >
                  <Send className="w-4 h-4" />
                  Submit Approval Request
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
};
