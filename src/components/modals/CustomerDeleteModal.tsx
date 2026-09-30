import React, { useState } from 'react';
import { Customer } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  X,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Send,
  UserX,
  CheckCircle2,
  Phone,
  MapPin,
  Wifi,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface CustomerDeleteModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerDeleteModal: React.FC<CustomerDeleteModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, hasFunctionAccess } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'direct' | 'request'>('direct');
  const [reason, setReason] = useState<string>('Customer shifted / relocated to another area');
  const [notes, setNotes] = useState<string>('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!isOpen || !customer) return null;

  const canDirectDelete =
    hasFunctionAccess('delete_customers') ||
    user?.role === 'Admin' ||
    user?.email === 'admin@trigonlinks.pk' ||
    user?.email === 'mohsinbhalli147@gmail.com';

  const handleDirectDelete = () => {
    if (!confirmedCheckbox) {
      showToast('warning', 'Confirmation Required', 'Please check the confirmation box to proceed with deletion.');
      return;
    }

    setIsDeleting(true);
    try {
      StorageService.deleteCustomer(customer.id, user?.email);
      showToast(
        'success',
        'Customer Permanently Deleted',
        `${customer.name} (${customer.username}) has been purged from the system.`
      );
      onSuccess();
      onClose();
    } catch (e) {
      console.error('Failed to delete customer:', e);
      showToast('error', 'Deletion Error', 'Unable to delete customer. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('error', 'Reason Required', 'Please select or provide a termination reason.');
      return;
    }

    const fullReason = notes.trim() ? `${reason} - ${notes.trim()}` : reason;
    StorageService.requestDeletion(
      'Customer',
      customer.id,
      `${customer.name} (${customer.username})`,
      user?.name || user?.email || 'Staff Operator',
      fullReason
    );

    showToast(
      'success',
      'Approval Request Placed',
      `Termination request for ${customer.name} has been submitted to Super Admin Approvals.`
    );
    onSuccess();
    onClose();
  };

  const quickReasons = [
    { label: 'Shifted / Relocated', icon: 'ðŸ ', val: 'Customer shifted / relocated to another area' },
    { label: 'ONT Returned', icon: 'ðŸ”Œ', val: 'ONT hardware returned & surrendered to office' },
    { label: 'Non-Payment Default', icon: 'ðŸ’³', val: 'Persistent non-payment default and arrears' },
    { label: 'Voluntary Cancellation', icon: 'âœ‚ï¸', val: 'Subscriber formally requested line disconnection' },
    { label: 'Duplicate Entry', icon: 'ðŸ‘¥', val: 'Duplicate or test subscriber account cleanup' },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Delete Customer Account"
      description="Permanent termination or dual-control Super Admin verification"
      size="lg"
    >
      <div className="-mx-6 -my-5">
        {/* Top Header Banner */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center font-black shadow-lg shadow-rose-950/50 shrink-0">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 font-bold uppercase tracking-wider">
                  Account Termination
                </span>
              </div>
            </div>
          </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs scrollbar-thin scrollbar-thumb-slate-800">
          {/* Customer Dossier Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm leading-tight">{customer.name}</h4>
                  <span className="font-mono text-cyan-400 text-[11px]">@{customer.username}</span>
                </div>
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  customer.status === 'Active'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {customer.status}
              </span>
            </div>

            {/* 4 Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-[11px]">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono truncate">{customer.mobile || 'No Mobile'}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-300">
                <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{customer.packageName}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{customer.areaName}</span>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono font-bold text-slate-200">
                  Monthly: Rs. {customer.totalMonthly.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Tabs for Authorized Admin */}
          {canDirectDelete && (
            <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setMode('direct')}
                className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'direct'
                    ? 'bg-rose-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Direct Purge</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('request')}
                className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  mode === 'request'
                    ? 'bg-amber-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin Approval</span>
              </button>
            </div>
          )}

          {/* TAB 1: DIRECT PERMANENT PURGE */}
          {canDirectDelete && mode === 'direct' && (
            <div className="space-y-4">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-950/40 border border-rose-900/80 text-rose-300 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Important Termination Notice</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-200/90 pl-1 leading-relaxed">
                  <li>PPPoE credentials and IP allocation will be permanently deleted.</li>
                  <li>Customer hardware (ONT / Router) should be reclaimed before purge.</li>
                  <li>All past ledger history will be closed and archived.</li>
                </ul>
              </div>

              {/* Security confirmation checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmedCheckbox}
                  onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer shrink-0"
                />
                <span className="text-[11px] text-slate-300 select-none leading-tight font-medium">
                  I understand that this action is irreversible and I confirm permanent termination of <strong>{customer.name}</strong>.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!confirmedCheckbox || isDeleting}
                  onClick={handleDirectDelete}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all ${
                    confirmedCheckbox && !isDeleting
                      ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white shadow-rose-950/50 hover:scale-[1.02]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SUBMIT FOR DUAL-CONTROL ADMIN APPROVAL */}
          {(!canDirectDelete || mode === 'request') && (
            <form onSubmit={handleRequestApproval} className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="leading-tight">
                  {!canDirectDelete
                    ? 'Your role requires Super Admin approval before subscriber records can be purged.'
                    : 'Submit this termination request into the Admin Approvals queue for secondary review.'}
                </span>
              </div>

              {/* Quick Reason Chips */}
              <div>
                <label className="block text-slate-300 font-bold mb-2">
                  Quick Select Reason
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {quickReasons.map((qr) => (
                    <button
                      key={qr.label}
                      type="button"
                      onClick={() => setReason(qr.val)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 text-[11px] ${
                        reason === qr.val
                          ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                      }`}
                    >
                      <span className="text-sm shrink-0">{qr.icon}</span>
                      <span className="truncate">{qr.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label htmlFor="selected-reason-statement" className="block text-slate-300 font-bold mb-1.5">
                  Selected Reason Statement *
                </label>
                <select
                   id="selected-reason-statement"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-400 text-xs"
                >
                  <option value="Customer shifted / relocated to another area">Customer shifted / relocated to another area</option>
                  <option value="ONT hardware returned & surrendered to office">ONT hardware returned & surrendered to office</option>
                  <option value="Persistent non-payment default and arrears">Persistent non-payment default and arrears</option>
                  <option value="Subscriber formally requested line disconnection">Subscriber formally requested line disconnection</option>
                  <option value="Duplicate or test subscriber account cleanup">Duplicate or test subscriber account cleanup</option>
                  <option value="Fiber line damaged / not feasible">Fiber line damaged / not feasible</option>
                  <option value="Other Custom Reason">Other Custom Reason</option>
                </select>
              </div>

              {/* Audit Notes */}
              <div>
                <label htmlFor="additional-audit-notes" className="block text-slate-300 font-bold mb-1.5">
                  Additional Audit Notes (Optional)
                </label>
                <textarea
                   id="additional-audit-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Hardware condition, outstanding arrears balance, remarks..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 text-xs resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/40 hover:scale-[1.02] transition-all"
                >
                  <Send className="w-4 h-4" />
                  Submit for Admin Approval
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
};

