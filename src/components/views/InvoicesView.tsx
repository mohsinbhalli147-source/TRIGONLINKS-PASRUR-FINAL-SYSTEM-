import React, { useState } from 'react';
import { Invoice } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Receipt, Search, Filter, CreditCard, Printer, CheckCircle2, Clock, X } from 'lucide-react';
import { PaymentModal } from '../modals/PaymentModal';
import { PrintReceiptModal } from '../modals/PrintReceiptModal';

export const InvoicesView: React.FC = () => {
  const { user, hasFunctionAccess } = useAuth();
  const { showToast } = useToast();

  const [{ invoices, customers }, refreshData] = useStorageCollections({
    invoices: () => StorageService.getInvoices(),
    customers: () => StorageService.getCustomers(),
  });

  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);

  const months = Array.from(new Set(invoices.map((i) => i.month)));

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerMobile.includes(search);
    const matchesMonth = monthFilter === 'All' || inv.month === monthFilter;
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesMonth && matchesStatus;
  });

  const handleOpenPayment = (inv: Invoice) => {
    if (!hasFunctionAccess('receive_payments')) {
      showToast('denied', 'Access Denied', 'Your staff account lacks permission to receive bill payments.');
      return;
    }
    setPayingInvoice(inv);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-cyan-400" />
            Invoices &amp; Accounts Receivable
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Subscriber monthly tax invoices, payment statuses, and remaining balances
          </p>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice #, customer name, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Month:</span>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="All">All Periods</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="All">All Invoices</option>
              <option value="Unpaid">Unpaid Only</option>
              <option value="Partial">Partial Only</option>
              <option value="Paid">Paid Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Subscriber</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4 text-right">Total Bill</th>
                <th className="py-3.5 px-4 text-right">Paid</th>
                <th className="py-3.5 px-4 text-right">Remaining</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                    #{inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-white">{inv.customerName}</p>
                    <p className="text-[11px] text-slate-400">{inv.customerMobile}</p>
                  </td>
                  <td className="py-3.5 px-4">{inv.month}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{inv.dueDate}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                    Rs. {inv.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                    Rs. {inv.paidAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-400">
                    Rs. {inv.remainingAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                          : inv.status === 'Partial'
                          ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                          : 'bg-rose-950/80 text-rose-400 border-rose-800'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {inv.status !== 'Paid' && (
                        <button
                           type="button"
                          onClick={() => handleOpenPayment(inv)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-bold text-[11px] transition-colors"
                          title="Receive Payment"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Pay
                        </button>
                      )}
                      <button
                         type="button"
                        onClick={() => setPrintingInvoice(inv)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                        title="Print / View Receipt"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
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

      {/* Print Receipt Modal */}
      {printingInvoice && (
        <PrintReceiptModal
          invoice={printingInvoice}
          onClose={() => setPrintingInvoice(null)}
        />
      )}
    </div>
  );
};
