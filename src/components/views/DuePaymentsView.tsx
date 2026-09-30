import React, { useState } from 'react';
import { Invoice } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Clock, CreditCard, Send, Search, AlertCircle, Phone, MessageSquare } from 'lucide-react';
import { PaymentModal } from '../modals/PaymentModal';

export const DuePaymentsView: React.FC = () => {
  const { user, hasFunctionAccess } = useAuth();
  const { showToast } = useToast();

  const [{ invoices, customers }, refreshData] = useStorageCollections({
    invoices: () => StorageService.getInvoices(),
    customers: () => StorageService.getCustomers(),
  });
  const [search, setSearch] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const dueInvoices = invoices.filter((i) => i.status !== 'Paid');

  const totalDue = dueInvoices.reduce((sum, i) => sum + i.remainingAmount, 0);

  const filtered = dueInvoices.filter(
    (inv) =>
      inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerMobile.includes(search) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleSendReminder = (inv: Invoice, type: 'SMS' | 'WhatsApp') => {
    StorageService.logActivity(
      user?.email || 'admin@trigonlinks.pk',
      user?.name || 'Staff',
      `Sent ${type} Due Reminder`,
      'invoices',
      `Dispatched automated payment reminder for Invoice #${inv.invoiceNumber} to ${inv.customerMobile} (${inv.customerName}). Outstanding: Rs. ${inv.remainingAmount}`
    );
    showToast('success', `${type} Reminder Dispatched`, `Payment reminder sent to ${inv.customerMobile} for Rs. ${inv.remainingAmount.toLocaleString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-400" />
            Overdue &amp; Pending Due Payments
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor delinquent subscriber accounts, remaining balances, and dispatch SMS/WhatsApp payment notices
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-900/60 text-rose-300 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Overdue Dues</span>
            <p className="text-base font-black text-rose-400 font-mono">
              Rs. {totalDue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search overdue subscribers, phone, bill #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>
        <span className="text-slate-400 font-semibold">{filtered.length} Overdue Accounts</span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Subscriber</th>
                <th className="py-3.5 px-4">Billing Month</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Total Bill</th>
                <th className="py-3.5 px-4 text-right">Paid</th>
                <th className="py-3.5 px-4 text-right">Outstanding Due</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                    #{inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-white">{inv.customerName}</p>
                    <p className="text-[11px] text-slate-400">{inv.customerMobile}</p>
                  </td>
                  <td className="py-3.5 px-4">{inv.month}</td>
                  <td className="py-3.5 px-4 font-mono text-rose-300 font-bold">{inv.dueDate}</td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    Rs. {inv.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                    Rs. {inv.paidAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 text-sm">
                    Rs. {inv.remainingAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'Partial'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                         type="button"
                        onClick={() => handleSendReminder(inv, 'WhatsApp')}
                        className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-400 transition-colors"
                        title="Send WhatsApp Payment Notice"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                         type="button"
                        onClick={() => handleSendReminder(inv, 'SMS')}
                        className="p-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-700/50 text-blue-400 transition-colors"
                        title="Send SMS Due Notice"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                         type="button"
                        onClick={() => setPayingInvoice(inv)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Receive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No overdue accounts. All bills are clear!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          customer={customers.find((c) => c.id === payingInvoice.customerId)}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}
    </div>
  );
};
