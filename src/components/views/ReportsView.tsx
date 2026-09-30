import React, { useState, useMemo } from 'react';
import { StorageService } from '../../services/storage';
import { buildCsv, downloadCsv } from '../../utils/csv';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  BarChart3,
  Download,
  DollarSign,
  Users,
  Calendar,
  Layers,
  Wrench,
  Package,
  CreditCard,
  Printer,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { hasFunctionAccess } = useAuth();
  const { showToast } = useToast();

  // Helper date generators
  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const getDaysAgoISO = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };
  const getMonthStartISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getLastMonthRange = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0],
    };
  };

  // State
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom' | 'all'>('month');
  const [startDate, setStartDate] = useState<string>(getMonthStartISO());
  const [endDate, setEndDate] = useState<string>(getTodayISO());
  const [activeTab, setActiveTab] = useState<'financial' | 'subscribers' | 'staff' | 'complaints' | 'inventory' | 'expenses'>('financial');

  // Load all storage data
  const customers = StorageService.getCustomers();
  const invoices = StorageService.getInvoices();
  const payments = StorageService.getPayments();
  const expenses = StorageService.getExpenses();
  const areas = StorageService.getAreas();
  const staff = StorageService.getStaff();
  const complaints = StorageService.getComplaints();
  const inventory = StorageService.getInventory();
  const connections = StorageService.getConnections();

  // Preset Handlers
  const handlePresetSelect = (selectedPreset: 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom' | 'all') => {
    setPreset(selectedPreset);
    const today = getTodayISO();

    if (selectedPreset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (selectedPreset === 'yesterday') {
      const yest = getDaysAgoISO(1);
      setStartDate(yest);
      setEndDate(yest);
    } else if (selectedPreset === 'week') {
      setStartDate(getDaysAgoISO(7));
      setEndDate(today);
    } else if (selectedPreset === 'month') {
      setStartDate(getMonthStartISO());
      setEndDate(today);
    } else if (selectedPreset === 'last_month') {
      const lm = getLastMonthRange();
      setStartDate(lm.start);
      setEndDate(lm.end);
    } else if (selectedPreset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(today);
    }
  };

  // Date filtering function
  const isDateInRange = (rawDate?: string) => {
    if (preset === 'all') return true;
    if (!rawDate) return false;
    // Extract YYYY-MM-DD
    const dStr = rawDate.trim().substring(0, 10);
    return dStr >= startDate && dStr <= endDate;
  };

  // Filtered collections
  const filteredInvoices = useMemo(
    () => invoices.filter((i) => isDateInRange(i.issueDate || i.createdAt || i.dueDate)),
    [invoices, startDate, endDate, preset]
  );

  const filteredPayments = useMemo(
    () => payments.filter((p) => isDateInRange(p.date)),
    [payments, startDate, endDate, preset]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => isDateInRange(e.date)),
    [expenses, startDate, endDate, preset]
  );

  const filteredComplaints = useMemo(
    () => complaints.filter((c) => isDateInRange(c.createdAt)),
    [complaints, startDate, endDate, preset]
  );

  const filteredConnections = useMemo(
    () => connections.filter((c) => isDateInRange(c.createdAt || c.requestDate || c.installDate)),
    [connections, startDate, endDate, preset]
  );

  // Financial calculations
  const totalBilled = filteredInvoices.reduce((sum, i) => sum + (i.amount || i.totalAmount || 0), 0);
  const totalCollected = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netOperatingProfit = totalCollected - totalExpenses;
  const collectionRate = totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 100;
  const uncollectedArrears = Math.max(0, totalBilled - totalCollected);

  // Payment methods breakdown
  const cashPayments = filteredPayments.filter((p) => (p.method || '').toLowerCase() === 'cash');
  const cashSum = cashPayments.reduce((sum, p) => sum + p.amount, 0);

  const digitalPayments = filteredPayments.filter((p) => (p.method || '').toLowerCase() !== 'cash');
  const digitalSum = digitalPayments.reduce((sum, p) => sum + p.amount, 0);

  // Export CSV
  const handleExportCSV = () => {
    if (!hasFunctionAccess('export_data')) {
      showToast('denied', 'Access Denied', 'Your staff role does not have Data Export privileges.');
      return;
    }

    const rangeLabel = preset === 'all' ? 'All Time' : `${startDate} to ${endDate}`;
    const rows = [
      ['TRIGON LINKS PASRUR - NOC FINANCIAL AUDIT & REVENUE REPORT', `Generated: ${new Date().toLocaleString()}`],
      ['Selected Date Period', rangeLabel],
      ['Preset Mode', preset.toUpperCase()],
      ['Total Recoveries Collected (PKR)', totalCollected],
      ['Total Invoices Billed (PKR)', totalBilled],
      ['Operational Expenses (PKR)', totalExpenses],
      ['Net Operating Profit / Surplus (PKR)', netOperatingProfit],
      ['Recovery Efficiency Rate', `${collectionRate}%`],
      ['Cash at Desk / Recoveries (PKR)', cashSum],
      ['Digital / Bank Recoveries (PKR)', digitalSum],
      ['New Connections In Period', filteredConnections.length],
      ['Complaints Handled In Period', filteredComplaints.length],
      [''],
      ['RECEIPTS & PAYMENTS DETAIL'],
      ['Receipt #', 'Subscriber', 'Method', 'Date', 'Amount (PKR)', 'Staff / Collector'],
      ...filteredPayments.map((p) => [
        p.receiptNumber || p.id,
        p.customerName || 'Subscriber',
        p.method || 'Cash',
        p.date || '',
        p.amount || 0,
        p.collectedBy || 'Admin Desk',
      ]),
      [''],
      ['EXPENSES DETAIL'],
      ['Expense Title', 'Category', 'Date', 'Amount (PKR)', 'Recorded By'],
      ...filteredExpenses.map((e) => [
        e.name,
        e.category,
        e.date,
        e.amount,
        e.recordedBy || 'Admin',
      ]),
    ];

    // Every cell is quoted and formula-escaped, and the file is delivered as a
    // blob rather than an encodeURI'd data: URL (which truncated on any "#" or
    // "?" appearing in subscriber data).
    const csv = buildCsv(['Report Line'], rows);
    downloadCsv(`trigon_financial_report_${startDate}_to_${endDate}`, csv);

    showToast('success', 'Report Exported', `Detailed report for ${rangeLabel} downloaded successfully.`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-cyan-400 shrink-0" />
              Operational &amp; Financial Reports
            </h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase tracking-wider">
              Financial Audit &amp; Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic date-filtered financial intelligence, recovery auditing, expenses, and net profit ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
             type="button"
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Print Complete Report"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
             type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700 hover:border-slate-600 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export Report CSV
          </button>
        </div>
      </div>

      {/* DATE SELECTOR & PRESETS CONTROL BOX */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Date Range &amp; Audit Period Filter
              </h3>
              <p className="text-[11px] text-slate-400">
                Choose any preset or enter custom start &amp; end dates to audit that exact period
              </p>
            </div>
          </div>

          {/* Active Range Badge */}
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
            <span className="text-slate-400">Auditing Period:</span>
            <span className="font-mono font-bold text-cyan-300">
              {preset === 'all' ? 'All Time (No Limits)' : `${startDate}  ➔  ${endDate}`}
            </span>
          </div>
        </div>

        {/* 1-Click Quick Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'today', label: '🌟 Today' },
            { id: 'yesterday', label: '📆 Yesterday' },
            { id: 'week', label: '📊 Last 7 Days' },
            { id: 'month', label: '🗓️ This Month' },
            { id: 'last_month', label: '⏮️ Last Month' },
            { id: 'all', label: '♾️ All Time' },
            { id: 'custom', label: '✏️ Custom Range' },
          ].map((item) => (
            <button
               type="button"
              key={item.id}
              onClick={() => handlePresetSelect(item.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                preset === item.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-950/40 font-black scale-[1.02]'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Start & End Date Pickers */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
          <div className="flex-1 flex items-center gap-2">
            <label htmlFor="from-date" className="text-slate-400 font-bold whitespace-nowrap min-w-[70px]">
              From Date:
            </label>
            <input
               id="from-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset('custom');
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex-1 flex items-center gap-2">
            <label htmlFor="to-date" className="text-slate-400 font-bold whitespace-nowrap min-w-[50px]">
              To Date:
            </label>
            <input
               id="to-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset('custom');
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <button
             type="button"
            onClick={() => handlePresetSelect('today')}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold border border-slate-800 hover:border-slate-700 transition-colors shrink-0"
            title="Reset to today"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            Reset Today
          </button>
        </div>
      </div>

      {/* 4 PRIMARY FINANCIAL KPI CARDS FOR SELECTED PERIOD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Total Recovered */}
        <div className="p-5 rounded-3xl bg-slate-900 border-2 border-emerald-900/60 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 uppercase font-black tracking-wider flex items-center gap-1">
              <ArrowDownRight className="w-4 h-4" /> Total Recovered (Collections)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            Rs. {totalCollected.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>{filteredPayments.length} Payment Receipts</span>
            <span className="font-semibold text-emerald-400 font-mono">{collectionRate}% Rate</span>
          </div>
        </div>

        {/* Total Billed */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Receipt className="w-4 h-4 text-cyan-400" /> Total Invoiced (Billed)
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono">
            Rs. {totalBilled.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>{filteredInvoices.length} Invoices</span>
            <span className="font-mono text-amber-400">Due: Rs. {uncollectedArrears.toLocaleString()}</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" /> Total Expenses
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 font-mono">
            Rs. {totalExpenses.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>{filteredExpenses.length} Expense Vouchers</span>
            <span className="text-slate-500">Fuel, Line, Salaries</span>
          </div>
        </div>

        {/* Net Operating Profit / Cash in Hand */}
        <div className={`p-5 rounded-3xl bg-slate-900 border-2 shadow-xl space-y-2 relative overflow-hidden ${
          netOperatingProfit >= 0 ? 'border-cyan-800/80' : 'border-rose-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] uppercase font-black tracking-wider flex items-center gap-1 ${
              netOperatingProfit >= 0 ? 'text-cyan-300' : 'text-rose-400'
            }`}>
              <TrendingUp className="w-4 h-4" /> Net Margin (Operating Profit)
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-300 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black font-mono ${
            netOperatingProfit >= 0 ? 'text-cyan-300' : 'text-rose-400'
          }`}>
            Rs. {netOperatingProfit.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <span>Recovered Minus Expenses</span>
            <span className="font-bold text-white">
              {netOperatingProfit >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
        </div>
      </div>

      {/* QUICK CASH VS DIGITAL BREAKDOWN BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
              💵
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Cash Recovery Desk</span>
              <span className="font-mono font-bold text-white text-sm">Rs. {cashSum.toLocaleString()}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            {cashPayments.length} txns
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800 text-blue-400 flex items-center justify-center font-bold">
              📱
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Online / Bank / Wallet</span>
              <span className="font-mono font-bold text-blue-400 text-sm">Rs. {digitalSum.toLocaleString()}</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            {digitalPayments.length} txns
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 text-purple-400 flex items-center justify-center font-bold">
              ⚡
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">New Connections In Period</span>
              <span className="font-mono font-bold text-purple-400 text-sm">{filteredConnections.length} Onboarded</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            {filteredComplaints.length} faults
          </span>
        </div>
      </div>

      {/* REPORT MODULE TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 text-xs">
        <button
           type="button"
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'financial'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" /> Financial Recoveries ({filteredPayments.length})
        </button>

        <button
           type="button"
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'expenses'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Expenses Ledger ({filteredExpenses.length})
        </button>

        <button
           type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'staff'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" /> Staff Recovery Performance
        </button>

        <button
           type="button"
          onClick={() => setActiveTab('subscribers')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'subscribers'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Subscribers &amp; Areas
        </button>

        <button
           type="button"
          onClick={() => setActiveTab('complaints')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'complaints'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" /> Faults &amp; Complaints ({filteredComplaints.length})
        </button>

        <button
           type="button"
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-950/40'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Inventory &amp; Stock
        </button>
      </div>

      {/* TAB 1: FINANCIAL RECOVERIES TABLE */}
      {activeTab === 'financial' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Payments &amp; Collections Ledger for Selected Period
              </h3>
              <p className="text-xs text-slate-400">
                Detailed breakdown of receipts generated between {startDate} and {endDate}
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-xl">
              Total: Rs. {totalCollected.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">Collector / Staff</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {p.receiptNumber || p.id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {p.date}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {p.customerName || 'Subscriber'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {p.collectedBy || 'Admin Desk'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-semibold text-[10px] text-slate-200">
                        {p.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                      Rs. {p.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                      No payment receipts recorded for the selected date range ({startDate} to {endDate}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES TABLE */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-400" />
                Operational Expenses Ledger ({startDate} to {endDate})
              </h3>
              <p className="text-xs text-slate-400">
                Itemized audit of funds spent on fiber repairs, vehicle fuel, office, and salaries
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-rose-400 px-3 py-1 bg-rose-950 border border-rose-800 rounded-xl">
              Total Expenses: Rs. {totalExpenses.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{exp.date}</td>
                    <td className="py-3 px-4 font-bold text-white">{exp.name}</td>
                    <td className="py-3 px-4 text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{exp.recordedBy || 'Admin'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 text-sm">
                      Rs. {exp.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                      No expenses recorded for this timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF RECOVERY PERFORMANCE */}
      {activeTab === 'staff' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                Staff Recovery Audit for Date Range
              </h3>
              <p className="text-xs text-slate-400">
                Amount collected by each field tech &amp; recovery agent between {startDate} and {endDate}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Sectors</th>
                  <th className="py-3 px-4 text-center">Receipts Count</th>
                  <th className="py-3 px-4 text-right">Total Recovered In Period</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {staff.map((st) => {
                  const staffPayments = filteredPayments.filter(
                    (p) => p.collectedBy?.toLowerCase().includes(st.name.toLowerCase()) || p.collectedBy?.includes(st.email)
                  );
                  const totalSum = staffPayments.reduce((sum, p) => sum + p.amount, 0);
                  const assignedAreas =
                    st.assignedAreaIds && st.assignedAreaIds.length > 0
                      ? areas.filter((a) => st.assignedAreaIds?.includes(a.id)).map((a) => a.name).join(', ')
                      : 'All Sectors';

                  return (
                    <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-bold text-xs">
                          {st.name.charAt(0)}
                        </div>
                        <div>
                          <div>{st.name}</div>
                          <span className="text-[10px] text-slate-500 font-mono">{st.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-cyan-400 font-semibold">{st.role}</td>
                      <td className="py-3 px-4 text-slate-400">{assignedAreas}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">
                        {staffPayments.length} txns
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                        Rs. {totalSum.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                          {st.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SUBSCRIBERS & AREAS */}
      {activeTab === 'subscribers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Coverage Zone &amp; Subscriber Density</h3>
              <p className="text-xs text-slate-400">Customer distribution and tariff revenue by sector</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Coverage Zone</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-center">Active Subs</th>
                  <th className="py-3 px-4 text-center">Suspended</th>
                  <th className="py-3 px-4 text-right">Monthly Tariff Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {areas.map((a) => {
                  const areaCusts = customers.filter((c) => c.areaId === a.id);
                  const activeCount = areaCusts.filter((c) => c.status === 'Active').length;
                  const suspCount = areaCusts.filter((c) => c.status === 'Suspended').length;
                  const zoneRevenue = areaCusts.reduce((sum, c) => sum + (c.totalMonthly || 0), 0);

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white">{a.name}</td>
                      <td className="py-3 px-4 text-slate-400">{a.city || 'Pasrur'}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">{activeCount}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-rose-400">{suspCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                        Rs. {zoneRevenue.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: COMPLAINTS & MTTR */}
      {activeTab === 'complaints' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Complaints &amp; Fault Tickets in Date Range</h3>
              <p className="text-xs text-slate-400">Tickets registered between {startDate} and {endDate}</p>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-400 px-3 py-1 bg-cyan-950 border border-cyan-800 rounded-xl">
              {filteredComplaints.length} Tickets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subscriber</th>
                  <th className="py-3 px-4">Issue Category</th>
                  <th className="py-3 px-4">Assigned Lineman</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">{c.ticketNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{c.createdAt?.substring(0, 10)}</td>
                    <td className="py-3 px-4 font-bold text-white">{c.customerName}</td>
                    <td className="py-3 px-4 text-slate-300">{c.category || 'Optical Fiber Break'}</td>
                    <td className="py-3 px-4 text-slate-400">{c.assignedToName || 'Asim Raza'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'Solved'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : c.status === 'Working'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredComplaints.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 italic">
                      No complaints registered in this timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: INVENTORY & STOCK */}
      {activeTab === 'inventory' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Hardware &amp; Optical Stock Status</h3>
              <p className="text-xs text-slate-400">Available equipment, unit costs, and inventory valuation</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">In Stock</th>
                  <th className="py-3 px-4 text-center">Min Threshold</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                    <td className="py-3 px-4 text-slate-400">{item.category}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-cyan-300">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {item.minStock} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                      Rs. {(item.sellingPrice || item.price || item.unitCost || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.quantity <= item.minStock
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {item.quantity <= item.minStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
