import React, { useState } from 'react';
import { Expense } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollection } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DollarSign, Plus, Search, Calendar, Tag, ArrowUpRight } from 'lucide-react';
import { Modal } from '../common/Modal';

export const ExpensesView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [expenses] = useStorageCollection<Expense[]>(
    () => StorageService.getExpenses(),
    ['trigon_expenses']
  );
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState('Upstream Bandwidth');
  const [amount, setAmount] = useState<number>(45000);
  const [description, setDescription] = useState('');
  const [paidTo, setPaidTo] = useState('');

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const openAdd = () => {
    setCategory('Upstream Bandwidth');
    setAmount(45000);
    setDescription('');
    setPaidTo('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !paidTo) return;

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      category,
      amount: Number(amount),
      description,
      date: new Date().toISOString().split('T')[0],
      recordedBy: user?.name || 'Staff',
      paidTo,
    };

    StorageService.saveExpense(newExp, user?.email);
    showToast('success', 'Expense Recorded', `Disbursed Rs. ${amount.toLocaleString()} for ${description}`);
    setIsModalOpen(false);
  };

  const categories = Array.from(new Set(expenses.map((e) => e.category)));

  const filtered = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.paidTo?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-rose-400" />
            Operational &amp; Infrastructure Expenses
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upstream bandwidth transit leases, pole rights-of-way, field technician fuel, and hardware purchases
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-900/60 text-rose-300 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Total Operations Cost</span>
              <p className="text-base font-black text-rose-400 font-mono">
                Rs. {totalExpense.toLocaleString()}
              </p>
            </div>
          </div>

          <button
             type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
          >
            <Plus className="w-4 h-4" />
            + Record Expense
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search description, recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Paid To</th>
                <th className="py-3.5 px-4 text-right">Amount (PKR)</th>
                <th className="py-3.5 px-4 text-right">Disbursed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400">{exp.date}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[11px]">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white max-w-sm">{exp.description}</td>
                  <td className="py-3.5 px-4 text-slate-200">{exp.paidTo}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 text-sm">
                    Rs. {exp.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400">{exp.recordedBy}</td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsModalOpen(false)}
          title="Record Business Operational Expense"
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label htmlFor="expense-category" className="block text-slate-300 font-bold mb-1">Expense Category *</label>
              <select
                 id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="Upstream Bandwidth">Upstream Bandwidth (PTCL/Transworld/Nayatel)</option>
                <option value="Pole Rental">Pole / Right-of-Way Municipal Rental</option>
                <option value="Fuel & Transport">Lineman Bike / Vehicle Fuel &amp; Transport</option>
                <option value="Hardware Purchases">Hardware &amp; Fiber Splicer Tools</option>
                <option value="Office & Electricity">Office Utility &amp; NOC Electricity</option>
                <option value="Salaries">Staff Salaries &amp; Overtime</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div>
              <label htmlFor="expense-amount" className="block text-slate-300 font-bold mb-1">Expense Amount (PKR) *</label>
              <input
                 id="expense-amount"
                type="number"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <label htmlFor="paid-to-vendor" className="block text-slate-300 font-bold mb-1">Paid To / Vendor *</label>
              <input
                 id="paid-to-vendor"
                type="text"
                required
                placeholder="e.g. PTCL Corporate Wholesale or Shell Petrol Pump"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="description-bill-memo" className="block text-slate-300 font-bold mb-1">Description / Bill Memo *</label>
              <textarea
                 id="description-bill-memo"
                rows={2}
                required
                placeholder="e.g. 1 Gbps CIR transit pipe lease for the month of September"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black shadow-lg shadow-rose-950/40"
              >
                Confirm Expense
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
