import React, { useState, useEffect } from 'react';
import { StaffMember, StaffSettlement } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  CreditCard,
  Building2,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Printer,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface StaffSettlementModalProps {
  initialStaff?: StaffMember | null;
  onClose: () => void;
  onSuccess: (settlement: StaffSettlement) => void;
}

export const StaffSettlementModal: React.FC<StaffSettlementModalProps> = ({
  initialStaff,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [staffList, setStaffList] = useState<StaffMember[]>(StorageService.getStaff());
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialStaff?.id || staffList[0]?.id || '');

  const currentStaff = staffList.find((s) => s.id === selectedStaffId) || initialStaff || staffList[0];

  // Calculate live balances for current staff
  const staffBalance = currentStaff
    ? StorageService.getStaffCashBalance(currentStaff)
    : { totalCollected: 0, totalSettled: 0, inHandBalance: 0 };

  const [amount, setAmount] = useState<number>(staffBalance.inHandBalance > 0 ? staffBalance.inHandBalance : 0);
  const [handoverMethod, setHandoverMethod] = useState<string>('Cash Handover to Admin');
  const [receiver, setReceiver] = useState<string>('Mohsin Bhalli (Super Admin)');
  const [reference, setReference] = useState<string>(`SLIP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('Weekly cash recovery settlement handed over to admin.');
  const [createdSettlement, setCreatedSettlement] = useState<StaffSettlement | null>(null);

  // Sync amount when staff selection changes
  useEffect(() => {
    if (currentStaff) {
      const bal = StorageService.getStaffCashBalance(currentStaff);
      if (bal.inHandBalance > 0) {
        setAmount(bal.inHandBalance);
      }
    }
  }, [selectedStaffId]);

  const remainingBalance = Math.max(0, staffBalance.inHandBalance - Number(amount || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentStaff) {
      showToast('error', 'Select Staff', 'Please select a staff member.');
      return;
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      showToast('error', 'Invalid Amount', 'Please enter a handover amount greater than zero.');
      return;
    }

    const newSettlement: StaffSettlement = {
      id: `stl-${Date.now()}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      staffEmail: currentStaff.email,
      amount: payAmount,
      previousBalance: staffBalance.inHandBalance,
      remainingBalance,
      date,
      handoverMethod,
      reference: reference.trim(),
      notes: notes.trim(),
      settledBy: user?.name || user?.email || 'Admin',
      receivedBy: receiver,
      status: 'Completed',
      createdAt: new Date().toISOString(),
    };

    StorageService.recordStaffSettlement(newSettlement, user?.email);
    showToast(
      'success',
      'Settlement Completed Successfully',
      `Handed over Rs. ${payAmount.toLocaleString()} from ${currentStaff.name} to ${receiver}.`
    );

    setCreatedSettlement(newSettlement);
    onSuccess(newSettlement);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Staff Cash Handover & Settlement • Collections & Settlement`}
      description="Deposit field collections into Admin account and clear staff cash-in-hand liability"
      size="lg"
    >
        {/* If settlement just recorded, show Confirmation / Voucher Screen */}
        {createdSettlement ? (
          <div className="py-6 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-xl font-black text-white">Cash Handover Completed &amp; Settled!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Rs. {createdSettlement.amount.toLocaleString()} successfully transferred from {createdSettlement.staffName} to {createdSettlement.receivedBy}
              </p>
            </div>

            {/* Official Slip Voucher Card */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Settlement Voucher #</span>
                <span className="font-mono font-bold text-cyan-400">{createdSettlement.reference}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Staff Member</span>
                  <span className="font-bold text-white">{createdSettlement.staffName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Admin Receiver</span>
                  <span className="font-bold text-emerald-400">{createdSettlement.receivedBy}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Date of Settlement</span>
                  <span className="font-mono text-slate-300">{createdSettlement.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Payment Method</span>
                  <span className="font-semibold text-slate-300">{createdSettlement.handoverMethod}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Amount Handed Over</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    Rs. {createdSettlement.amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Staff Remaining Balance</span>
                  <span className="text-base font-black text-slate-300 font-mono">
                    Rs. {createdSettlement.remainingBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                Print Settlement Slip
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all"
              >
                Done / Close
              </button>
            </div>
          </div>
        ) : (
          /* Handover Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 py-4 space-y-5 text-xs">
            {/* Step 1: Staff Selection & Current Balance */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <label htmlFor="settlement-staff-member" className="block text-slate-300 font-bold mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  Select Staff Member for Settlement *
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Staff Collection Account
                </span>
              </label>

              <select
                 id="settlement-staff-member"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-cyan-400 text-xs"
              >
                {staffList.map((st) => {
                  const bal = StorageService.getStaffCashBalance(st);
                  return (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role}) &bull; In-Hand Cash: Rs. {bal.inHandBalance.toLocaleString()} (Total Collected: Rs. {bal.totalCollected.toLocaleString()})
                    </option>
                  );
                })}
              </select>

              {/* Staff Balances Banner */}
              {currentStaff && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-slate-950">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Collected</span>
                    <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                      Rs. {staffBalance.totalCollected.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Handed Over</span>
                    <span className="text-sm font-bold text-blue-400 font-mono mt-0.5 block">
                      Rs. {staffBalance.totalSettled.toLocaleString()}
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border ${staffBalance.inHandBalance > 0 ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                    <span className="text-[10px] uppercase font-bold block">Current In-Hand Cash</span>
                    <span className="text-base font-black font-mono mt-0.5 block">
                      Rs. {staffBalance.inHandBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Amount to Handover & Quick Full Settle */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="handover-amount" className="text-slate-300 font-bold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Amount to Handover to Admin (Rs.) *
                </label>

                {staffBalance.inHandBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(staffBalance.inHandBalance)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-700/80 text-emerald-300 font-bold text-[10px] hover:bg-emerald-900 transition-colors"
                  >
                    ⚡ Handover Full Balance (Rs. {staffBalance.inHandBalance.toLocaleString()})
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  id="handover-amount"
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-emerald-500/80 rounded-xl text-emerald-400 font-mono text-xl font-black focus:outline-none focus:border-emerald-400 pl-10"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rs.</span>
              </div>

              {/* Live Balance Computation Preview */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Previous In-Hand Cash</span>
                  <span className="font-mono font-bold text-slate-300">
                    Rs. {staffBalance.inHandBalance.toLocaleString()}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Handing Over</span>
                  <span className="font-mono font-bold text-emerald-400">
                    -Rs. {(Number(amount) || 0).toLocaleString()}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Remaining In-Hand Cash</span>
                  <span className={`font-mono font-black ${remainingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    Rs. {remainingBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Handover Channel & Receiver */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="handover-channel-mode" className="block text-slate-300 font-bold mb-1.5">Handover Channel / Mode *</label>
                <select
                   id="handover-channel-mode"
                  value={handoverMethod}
                  onChange={(e) => setHandoverMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Cash Handover to Admin">Cash Handover in Office (In Person)</option>
                  <option value="Bank Deposit to Admin Account">Bank Deposit to Admin (Meezan/HBL)</option>
                  <option value="EasyPaisa">EasyPaisa to Admin</option>
                  <option value="JazzCash">JazzCash to Admin</option>
                  <option value="Cheque">Bank Cheque / Pay Order</option>
                </select>
              </div>

              <div>
                <label htmlFor="received-by" className="block text-slate-300 font-bold mb-1.5">Received By (Admin Account) *</label>
                <input
                   id="received-by"
                  type="text"
                  required
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="e.g. Mohsin Bhalli (Super Admin)"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="date-of-handover" className="block text-slate-300 font-bold mb-1.5">Date of Handover *</label>
                <input
                   id="date-of-handover"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label htmlFor="deposit-slip-ref-id" className="block text-slate-300 font-bold mb-1.5">Deposit Slip # / Ref ID</label>
                <input
                   id="deposit-slip-ref-id"
                  type="text"
                  placeholder="e.g. SLIP-2026-904"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="settlement-remarks-notes" className="block text-slate-300 font-bold mb-1.5">Settlement Remarks / Notes</label>
                <input
                   id="settlement-remarks-notes"
                  type="text"
                  placeholder="Weekly collection verified and received in office..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 hover:scale-[1.02] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm &amp; Settle Handover (Rs. {Number(amount || 0).toLocaleString()})
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
};
