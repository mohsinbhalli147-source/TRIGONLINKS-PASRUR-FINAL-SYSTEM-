import React, { useState } from 'react';
import { Customer, Invoice, Payment, StaffMember } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CreditCard, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';

interface PaymentModalProps {
  invoice: Invoice;
  customer?: Customer;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, customer, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [amount, setAmount] = useState<number>(invoice.remainingAmount);
  const [method, setMethod] = useState<Payment['method']>('Cash');
  const [reference, setReference] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Staff Collector for Collections Management
  const [staffList] = useState<StaffMember[]>(StorageService.getStaff());
  const [collector, setCollector] = useState<string>(
    user?.name || (staffList.length > 0 ? `${staffList[0].name} (${staffList[0].role})` : 'Mohsin Bhalli (Admin)')
  );

  // Find customer if not directly provided
  const currentCustomer = customer || StorageService.getCustomers().find((c) => c.id === invoice.customerId);
  const walletBalance = currentCustomer?.walletBalance || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      showToast('error', 'Invalid Amount', 'Payment amount must be greater than zero.');
      return;
    }

    if (discount > 0 && !discountReason.trim()) {
      showToast('error', 'Reason Required', 'Please provide a justification reason for the applied discount.');
      return;
    }

    if (method === 'Wallet') {
      if (walletBalance < amount) {
        showToast('error', 'Insufficient Wallet Balance', `Customer wallet has Rs. ${walletBalance.toLocaleString()}, but payment is Rs. ${amount.toLocaleString()}.`);
        return;
      }
    }

    setIsSubmitting(true);
    const receiptNum = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      receiptNumber: receiptNum,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      amount,
      method,
      reference: reference || (method === 'Wallet' ? `WALLET-DEDUCT-${Date.now()}` : `MANUAL-${Date.now()}`),
      discount,
      discountReason: discount > 0 ? discountReason : undefined,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      collectedBy: collector,
    };

    StorageService.recordPayment(newPayment, user?.email);
    showToast('success', 'Payment Received', `Recorded payment of Rs. ${amount.toLocaleString()} for ${invoice.customerName}`);
    setIsSubmitting(false);
    onSuccess(newPayment);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Receive Bill Payment"
      description={`Invoice #${invoice.invoiceNumber} \u2022 ${invoice.month}`}
      size="lg"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 text-emerald-400 flex items-center justify-center">
          <CreditCard className="w-5 h-5" />
        </div>
      </div>

        {/* Invoice Summary Box */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 mb-6 grid grid-cols-3 gap-3 text-center">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Bill</span>
            <p className="text-sm font-bold text-white mt-0.5">Rs. {invoice.amount.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Paid So Far</span>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">Rs. {invoice.paidAmount.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Remaining Due</span>
            <p className="text-sm font-bold text-rose-400 mt-0.5">Rs. {invoice.remainingAmount.toLocaleString()}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="payment-amount" className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">
              Payment Amount (PKR) *
            </label>
            <input
               id="payment-amount"
              type="number"
              required
              min={1}
              max={invoice.remainingAmount}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-400 text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1">Default is full remaining balance (Rs. {invoice.remainingAmount})</p>
          </div>

          <div>
            <label htmlFor="payment-method" className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">
              Payment Method *
            </label>
            <select
               id="payment-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as Payment['method'])}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-400 text-sm"
            >
              <option value="Cash">Cash at Counter / Field Collection</option>
              <option value="JazzCash">JazzCash Mobile Wallet</option>
              <option value="EasyPaisa">EasyPaisa Mobile Wallet</option>
              <option value="Bank Transfer">Bank Transfer / IBFT</option>
              <option value="Online">Online Card / Gateway</option>
              <option value="Wallet">Customer Digital Wallet (Advance Balance)</option>
            </select>
          </div>

          {/* Wallet Section (If Wallet selected) */}
          {method === 'Wallet' && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  Customer Current Wallet Balance:
                </span>
                <span className="font-extrabold text-sm text-indigo-300">
                  Rs. {walletBalance.toLocaleString()}
                </span>
              </div>
              {walletBalance >= amount ? (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sufficient balance. Rs. {amount.toLocaleString()} will be automatically deducted.
                </p>
              ) : (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> Insufficient balance! Top up wallet or adjust payment amount.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reference-trx-id" className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">
                Reference / Trx ID
              </label>
              <input
                 id="reference-trx-id"
                type="text"
                placeholder="e.g. TID-9821382"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label htmlFor="discount" className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">
                Discount (PKR)
              </label>
              <input
                 id="discount"
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Collected By (Staff Recovery Attribution) */}
          <div>
            <label htmlFor="payment-collected-by" className="block text-slate-300 font-bold mb-1 uppercase tracking-wider flex items-center justify-between">
              <span>Collected By (Staff Account)</span>
              <span className="text-[10px] text-cyan-400 font-normal">Cash In-Hand Ledger</span>
            </label>
            <select
               id="payment-collected-by"
              value={collector}
              onChange={(e) => setCollector(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-cyan-400 text-xs"
            >
              <option value={user?.name ? `${user.name} (Active User)` : 'Mohsin Bhalli (Super Admin)'}>
                {user?.name ? `${user.name} (Active Session)` : 'Mohsin Bhalli (Super Admin)'}
              </option>
              {staffList.map((st) => (
                <option key={st.id} value={`${st.name} (${st.role})`}>
                  {st.name} &bull; {st.role} &bull; ({st.email})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Payment will be logged under this staff member&apos;s recovery balance until handed over to Admin.
            </p>
          </div>

          {discount > 0 && (
            <div>
              <label htmlFor="discount-reason" className="block text-slate-300 font-bold mb-1 uppercase tracking-wider">
                Discount Reason *
              </label>
              <input
                 id="discount-reason"
                type="text"
                required
                placeholder="Reason for discount waiver (e.g. Promotional offer, SLA downtime waiver)"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (method === 'Wallet' && walletBalance < amount)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              Confirm &amp; Record Payment
            </button>
          </div>
        </form>
    </Modal>
  );
};

