import React, { useState } from 'react';
import { Payment } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollection } from '../../hooks/useStorageCollection';
import { CreditCard, Search, Calendar, Filter, Wallet, ArrowDownLeft } from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const [payments] = useStorageCollection<Payment[]>(
    () => StorageService.getPayments(),
    ['trigon_payments']
  );
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const filtered = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference && p.reference.toLowerCase().includes(search.toLowerCase()));
    const matchesMethod = methodFilter === 'All' || p.method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Payment Collections &amp; Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of all cash receipts, digital wallets, bank transfers, and field recoveries
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-900/60 text-emerald-300 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Recoveries</span>
            <p className="text-base font-black text-emerald-400 font-mono">
              Rs. {totalCollected.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search receipt #, subscriber, Trx ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Payment Mode:</span>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="All">All Channels</option>
            <option value="Cash">Cash Collections</option>
            <option value="JazzCash">JazzCash</option>
            <option value="EasyPaisa">EasyPaisa</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Wallet">Digital Wallet</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Receipt #</th>
                <th className="py-3.5 px-4">Subscriber</th>
                <th className="py-3.5 px-4">Date &amp; Time</th>
                <th className="py-3.5 px-4">Channel / Mode</th>
                <th className="py-3.5 px-4">Trx Ref</th>
                <th className="py-3.5 px-4 text-right">Amount (PKR)</th>
                <th className="py-3.5 px-4 text-right">Collected By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                    {pay.receiptNumber}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">{pay.customerName}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{pay.date}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        pay.method === 'Wallet'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : pay.method === 'JazzCash' || pay.method === 'EasyPaisa'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : pay.method === 'Bank Transfer'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {pay.method === 'Wallet' && <Wallet className="w-3 h-3" />}
                      {pay.method}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                    {pay.reference || '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                    Rs. {pay.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-300 font-medium">
                    {pay.collectedBy}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No payment transactions recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
