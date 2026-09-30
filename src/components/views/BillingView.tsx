import React, { useState } from 'react';
import { Invoice } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Calculator,
  Play,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Receipt,
  Users,
  DollarSign,
  ArrowRight,
} from 'lucide-react';

export const BillingView: React.FC = () => {
  const { user, hasFunctionAccess, setActiveSection } = useAuth();
  const { showToast } = useToast();

  const [{ customers, invoices }] = useStorageCollections({
    customers: () => StorageService.getCustomers(),
    invoices: () => StorageService.getInvoices(),
  });

  // Generation Form
  const [selectedMonth, setSelectedMonth] = useState<string>('October 2026');
  const [selectedDueDate, setSelectedDueDate] = useState<string>('2026-10-10');
  const [isGenerating, setIsGenerating] = useState(false);

  const activeCustomers = customers.filter((c) => c.status === 'Active');
  const alreadyBilledForMonth = invoices.filter((i) => i.month === selectedMonth);
  const eligibleToBill = activeCustomers.filter(
    (c) => !alreadyBilledForMonth.some((inv) => inv.customerId === c.id)
  );
  const projectedRevenue = eligibleToBill.reduce((sum, c) => sum + (c.totalMonthly || 0), 0);

  const handleGenerateBatch = () => {
    if (!hasFunctionAccess('generate_bills')) {
      showToast('denied', 'Access Denied', 'Your staff account lacks permission to execute batch bill runs.');
      return;
    }

    if (eligibleToBill.length === 0) {
      showToast('info', 'Already Billed', `All active subscribers have already been billed for ${selectedMonth}.`);
      return;
    }

    setIsGenerating(true);

    const generated = StorageService.generateBatchInvoices(selectedMonth, selectedDueDate, user?.email);

    setTimeout(() => {
      setIsGenerating(false);
      showToast(
        'success',
        'Batch Invoicing Complete',
        `Successfully generated ${generated.length} invoices totaling Rs. ${projectedRevenue.toLocaleString()} for ${selectedMonth}.`
      );
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-cyan-400" />
            Automated Billing Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Batch invoice generator for recurring broadband packages, static IPs, and IPTV services
          </p>
        </div>

        <button
           type="button"
          onClick={() => setActiveSection('invoices')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
        >
          <Receipt className="w-4 h-4 text-cyan-400" />
          View All Invoices ({invoices.length}) &rarr;
        </button>
      </div>

      {/* Generation Control Panel */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Monthly Invoicing Run
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Execute batch invoice generation for all active subscribers. The billing engine will automatically calculate package tariffs, static IP allocations, and IPTV add-ons, applying duplicate-prevention safeguards.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="billing-period-month" className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Billing Period / Month *
              </label>
              <select
                 id="billing-period-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold text-xs focus:outline-none focus:border-cyan-400"
              >
                <option value="October 2026">October 2026</option>
                <option value="November 2026">November 2026</option>
                <option value="December 2026">December 2026</option>
                <option value="September 2026">September 2026 (Reprocess)</option>
              </select>
            </div>

            <div>
              <label htmlFor="payment-due-date" className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Payment Due Date *
              </label>
              <input
                 id="payment-due-date"
                type="date"
                value={selectedDueDate}
                onChange={(e) => setSelectedDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Forecast Box */}
          <div className="mt-6 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Eligible Subscribers</span>
              <p className="text-lg font-black text-white mt-0.5">{eligibleToBill.length}</p>
              <p className="text-[10px] text-slate-500">of {activeCustomers.length} active</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Already Invoiced</span>
              <p className="text-lg font-black text-cyan-300 mt-0.5">{alreadyBilledForMonth.length}</p>
              <p className="text-[10px] text-slate-500">Safeguarded</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Batch Total (PKR)</span>
              <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                Rs. {projectedRevenue.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500">Expected receivables</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
               type="button"
              onClick={handleGenerateBatch}
              disabled={isGenerating || eligibleToBill.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-xl shadow-cyan-950/40 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Generating Invoices...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Execute Batch Generation ({eligibleToBill.length} Invoices)
                </>
              )}
            </button>

            {eligibleToBill.length === 0 && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Up to date for {selectedMonth}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Invoice Generations List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h4 className="font-bold text-white text-sm mb-3">Recent Invoicing History</h4>
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-white">September 2026 Regular Billing Run</p>
              <p className="text-slate-400 text-[11px]">Due Date: 10 Sep 2026 &bull; Executed by Admin</p>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 font-mono font-bold">Rs. 8,500 Generated</span>
              <p className="text-[10px] text-slate-500">Active cycle</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
