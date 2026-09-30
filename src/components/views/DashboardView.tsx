import React from 'react';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  DollarSign,
  Receipt,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  TrendingUp,
  Wifi,
  PlusCircle,
  FileText,
  Wrench,
  Package,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Smartphone,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Customer, Complaint, Invoice, ConnectionRequest } from '../../types';

export const DashboardView: React.FC = () => {
  const { user, setActiveSection, hasSectionAccess } = useAuth();

  const [
    {
      allCustomers,
      allPackages,
      allAreas,
      allInvoices,
      allPayments,
      allInventory,
      allComplaints,
      allExpenses,
      allConnections,
      allStaff,
      allDeletionRequests,
    },
  ] = useStorageCollections({
    allCustomers: () => StorageService.getCustomers(),
    allPackages: () => StorageService.getPackages(),
    allAreas: () => StorageService.getAreas(),
    allInvoices: () => StorageService.getInvoices(),
    allPayments: () => StorageService.getPayments(),
    allInventory: () => StorageService.getInventory(),
    allComplaints: () => StorageService.getComplaints(),
    allExpenses: () => StorageService.getExpenses(),
    allConnections: () => StorageService.getConnections(),
    allStaff: () => StorageService.getStaff(),
    allDeletionRequests: () => StorageService.getDeletionRequests(),
  });

  // Filter datasets based on staff assigned areas (if staff has assigned areas restricted)
  const isStaffAreaRestricted =
    user?.role !== 'Admin' && user?.assignedAreaIds && user.assignedAreaIds.length > 0;

  const customers: Customer[] = isStaffAreaRestricted
    ? allCustomers.filter((c) => user?.assignedAreaIds?.includes(c.areaId))
    : allCustomers;

  const complaints: Complaint[] = isStaffAreaRestricted
    ? allComplaints.filter((c) => {
        const cust = allCustomers.find((cu) => cu.id === c.customerId);
        return cust && user?.assignedAreaIds?.includes(cust.areaId);
      })
    : allComplaints;

  const connections: ConnectionRequest[] = isStaffAreaRestricted
    ? allConnections.filter((conn) => user?.assignedAreaIds?.includes(conn.areaId))
    : allConnections;

  const invoices: Invoice[] = isStaffAreaRestricted
    ? allInvoices.filter((inv) => {
        const cust = allCustomers.find((cu) => cu.id === inv.customerId);
        return cust && user?.assignedAreaIds?.includes(cust.areaId);
      })
    : allInvoices;

  const payments = isStaffAreaRestricted
    ? allPayments.filter((p) => {
        const cust = allCustomers.find((cu) => cu.id === p.customerId);
        return cust && user?.assignedAreaIds?.includes(cust.areaId);
      })
    : allPayments;

  // KPI Calculations
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === 'Active').length;
  const suspendedCustomers = customers.filter((c) => c.status === 'Suspended').length;

  const monthlyRevenue = customers
    .filter((c) => c.status === 'Active')
    .reduce((sum, c) => sum + (c.totalMonthly || 0), 0);

  const pendingInvoicesList = invoices.filter((i) => i.status !== 'Paid');
  const pendingInvoicesCount = pendingInvoicesList.length;
  const totalDueAmount = pendingInvoicesList.reduce((sum, i) => sum + (i.remainingAmount || 0), 0);

  const lowStockItems = allInventory.filter((i) => i.quantity <= i.minStock);
  const lowStockCount = lowStockItems.length;

  const pendingComplaintsCount = complaints.filter((c) => c.status === 'Pending').length;
  const workingComplaintsCount = complaints.filter((c) => c.status === 'Working').length;
  const solvedComplaintsCount = complaints.filter((c) => c.status === 'Solved').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPayments = payments.filter((p) => p.date && p.date.startsWith(todayStr));
  // Previously fell back to the all-time totals whenever today had no payments,
  // so the tile showed lifetime revenue under a "today" label.
  const todayPaymentsCount = todayPayments.length;
  const todayPaymentsSum = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  // Staff specific complaints assigned to this user
  const myAssignedComplaints = allComplaints.filter(
    (c) =>
      c.assignedToId === user?.staffId ||
      c.assignedToId === user?.uid ||
      (user?.name && c.assignedStaff?.toLowerCase().includes(user.name.toLowerCase()))
  );

  /* ---------------------------------------------------------------------- */
  /*  Chart data                                                            */
  /*                                                                         */
  /*  These were previously hardcoded sample figures (revenue 185000-310000, */
  /*  growth 68-158) presented in a "Executive NOC Command Center" heading,  */
  /*  so the board-level charts showed invented numbers. They are now        */
  /*  computed from the actual payment, expense and connection records.      */
  /* ---------------------------------------------------------------------- */

  const monthKeys = (() => {
    const keys: string[] = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let back = 5; back >= 0; back -= 1) {
      const point = new Date(cursor.getFullYear(), cursor.getMonth() - back, 1);
      keys.push(
        `${point.toLocaleString('en-US', { month: 'short' })} ${point.getFullYear()}`
      );
    }
    return keys;
  })();

  const monthIndexOf = (value?: string): number => {
    if (!value) return -1;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return -1;
    const label = `${parsed.toLocaleString('en-US', { month: 'short' })} ${parsed.getFullYear()}`;
    return monthKeys.indexOf(label);
  };

  const revenueByMonth = new Map<string, { revenue: number; expenses: number }>(
    monthKeys.map((key) => [key, { revenue: 0, expenses: 0 }])
  );
  const growthByMonth = new Map<string, number>(monthKeys.map((key) => [key, 0]));

  for (const payment of payments) {
    const index = monthIndexOf(payment.date);
    if (index >= 0) {
      const entry = revenueByMonth.get(monthKeys[index])!;
      entry.revenue += payment.amount || 0;
    }
  }
  for (const expense of allExpenses) {
    const index = monthIndexOf(expense.date);
    if (index >= 0) {
      const entry = revenueByMonth.get(monthKeys[index])!;
      entry.expenses += expense.amount || 0;
    }
  }
  // New connections are the only trustworthy growth signal available; counting
  // customers per month would report the same total every month.
  for (const connection of connections) {
    const index = monthIndexOf(connection.createdAt);
    if (index >= 0 && connection.status === 'Approved') {
      growthByMonth.set(monthKeys[index], (growthByMonth.get(monthKeys[index]) ?? 0) + 1);
    }
  }

  const revenueChartData = monthKeys.map((key) => ({
    month: key.split(' ')[0],
    revenue: revenueByMonth.get(key)!.revenue,
    expenses: revenueByMonth.get(key)!.expenses,
  }));

  const peakRevenue = Math.max(
    ...revenueChartData.map((d) => Math.max(d.revenue, d.expenses)),
    1
  );
  const maxRevenueVal = peakRevenue * 1.15;

  let runningTotal = 0;
  const customerGrowthData = monthKeys.map((key) => {
    runningTotal += growthByMonth.get(key) ?? 0;
    return { month: key.split(' ')[0], count: runningTotal };
  });

  const connStatusCounts = {
    Active: activeCustomers,
    Suspended: suspendedCustomers,
    Pending: connections.filter((c) => c.status === 'Pending').length,
  };
  const connTotal = Object.values(connStatusCounts).reduce((a, b) => a + b, 0) || 1;

  const packageRevenueMap: Record<string, { name: string; amount: number; count: number }> = {};
  customers.forEach((c) => {
    const pkgName = c.packageName || 'Basic Plan';
    if (!packageRevenueMap[pkgName]) {
      packageRevenueMap[pkgName] = { name: pkgName, amount: 0, count: 0 };
    }
    packageRevenueMap[pkgName].amount += c.totalMonthly;
    packageRevenueMap[pkgName].count += 1;
  });
  const packageRevenueList = Object.values(packageRevenueMap);

  return (
    <div className="space-y-6 pb-16 lg:pb-6">
      {/* Welcome Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {user?.role === 'Admin' ? 'Executive NOC Command Center' : `${user?.name} (${user?.role}) Portal`}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-800">
              {isStaffAreaRestricted ? 'ASSIGNED SECTORS' : 'LIVE NOC'}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Logged in as <span className="font-bold text-white">{user?.name}</span> &bull;{' '}
            <span className="text-cyan-400 font-semibold">{user?.role}</span>. Dashboard customized to your assigned permissions &amp; sectors.
          </p>
        </div>

        {/* Dynamic Quick Action Buttons (Adapted to User Allowed Functions) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {hasSectionAccess('customers') && (
            <button
               type="button"
              onClick={() => setActiveSection('customers')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-md active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Customer
            </button>
          )}
          {hasSectionAccess('billing') && (
            <button
               type="button"
              onClick={() => setActiveSection('billing')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all border border-slate-700 active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              Generate Bills
            </button>
          )}
          {hasSectionAccess('complaints') && (
            <button
               type="button"
              onClick={() => setActiveSection('complaints')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all border border-slate-700 active:scale-95"
            >
              <Wrench className="w-3.5 h-3.5" />
              Log Complaint
            </button>
          )}
        </div>
      </div>

      {/* Staff Assigned Tasks Banner (Shown for Technician/Support with assigned tickets) */}
      {myAssignedComplaints.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-900/80 border border-amber-700 flex items-center justify-center text-amber-300 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs sm:text-sm">
                You have {myAssignedComplaints.filter((c) => c.status !== 'Solved').length} pending assigned support tickets!
              </h4>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Review assigned optical faults and subscriber complaints in your coverage zone.
              </p>
            </div>
          </div>
          <button
             type="button"
            onClick={() => setActiveSection('complaints')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0"
          >
            Open My Tickets &rarr;
          </button>
        </div>
      )}

      {/* Dynamic KPI Widgets Grid (Responsive: 1 col on xs, 2 on sm, 3 on lg, 6 on xl) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Customers Widget */}
        {hasSectionAccess('customers') && (
          <div
            onClick={() => setActiveSection('customers')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-cyan-800/80 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">
                {isStaffAreaRestricted ? 'My Area Users' : 'Total Customers'}
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-white">{totalCustomers}</span>
              <span className="text-[11px] font-bold text-emerald-400">({activeCustomers} Active)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {suspendedCustomers > 0 ? `${suspendedCustomers} suspended` : 'All good'}
            </p>
          </div>
        )}

        {/* 2. Monthly Revenue Widget */}
        {(user?.role === 'Admin' || hasSectionAccess('reports') || hasSectionAccess('invoices')) && (
          <div
            onClick={() => hasSectionAccess('reports') && setActiveSection('reports')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-emerald-800/80 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">
                {isStaffAreaRestricted ? 'Area Revenue' : 'Monthly Revenue'}
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-slate-400">Rs.</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {monthlyRevenue.toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">Active MRR sum</p>
          </div>
        )}

        {/* 3. Pending Invoices Widget */}
        {(hasSectionAccess('invoices') || hasSectionAccess('due-payments') || hasSectionAccess('payments')) && (
          <div
            onClick={() => setActiveSection('due-payments')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-rose-800/80 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Pending Dues</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-950 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-rose-400">{pendingInvoicesCount}</span>
              <span className="text-[11px] font-bold text-rose-300 font-mono">Rs. {totalDueAmount.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">Unpaid recovery</p>
          </div>
        )}

        {/* 4. Low Stock Widget */}
        {hasSectionAccess('inventory') && (
          <div
            onClick={() => setActiveSection('stock-alerts')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-amber-800/80 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Low Stock</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl sm:text-2xl font-black ${lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
                {lowStockCount}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">Items &lt; Min</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">Hardware buffer</p>
          </div>
        )}

        {/* 5. Complaints Widget */}
        {hasSectionAccess('complaints') && (
          <div
            onClick={() => setActiveSection('complaints')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-blue-800/80 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Complaints</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-xl sm:text-2xl font-black ${pendingComplaintsCount > 0 ? 'text-blue-400' : 'text-white'}`}>
                {pendingComplaintsCount}
              </span>
              <span className="text-[11px] font-bold text-slate-400">({workingComplaintsCount} In Work)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">{solvedComplaintsCount} resolved</p>
          </div>
        )}

        {/* 6. Today Payments Widget */}
        {(hasSectionAccess('payments') || hasSectionAccess('billing')) && (
          <div
            onClick={() => setActiveSection('payments')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-indigo-800/80 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Today Collection</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-indigo-300">{todayPaymentsCount}</span>
              <span className="text-[11px] font-bold text-slate-300 font-mono">Rs. {todayPaymentsSum.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">Cash &amp; Online</p>
          </div>
        )}
      </div>

      {/* Visual Charts (Shown for Admin or Staff with analytics access) */}
      {(user?.role === 'Admin' || hasSectionAccess('reports')) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CHART 1: Revenue Overview */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Revenue Overview</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Last 6 Months)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Monthly recurring revenue vs operations cost</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
                  <span className="text-slate-300 text-[11px]">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80" />
                  <span className="text-slate-300 text-[11px]">Expenses</span>
                </div>
              </div>
            </div>

            {/* SVG Bar Chart */}
            <div className="h-56 sm:h-60 w-full flex items-end justify-between gap-2 sm:gap-3 pt-6 pb-2 px-1">
              {revenueChartData.map((item) => {
                const revHeight = (item.revenue / maxRevenueVal) * 100;
                const expHeight = (item.expenses / maxRevenueVal) * 100;

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                      <div
                        style={{ height: `${revHeight}%` }}
                        className="w-1/2 max-w-[20px] sm:max-w-[24px] rounded-t-lg bg-gradient-to-t from-cyan-600 to-cyan-400 group-hover:brightness-110 transition-all relative flex justify-center"
                      >
                        <span className="absolute -top-7 text-[9px] sm:text-[10px] font-mono text-cyan-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded shadow z-10">
                          Rs. {(item.revenue / 1000).toFixed(0)}k
                        </span>
                      </div>

                      <div
                        style={{ height: `${expHeight}%` }}
                        className="w-1/2 max-w-[20px] sm:max-w-[24px] rounded-t-lg bg-gradient-to-t from-rose-600 to-rose-400 group-hover:brightness-110 transition-all relative flex justify-center"
                      >
                        <span className="absolute -top-7 text-[9px] sm:text-[10px] font-mono text-rose-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded shadow z-10">
                          Rs. {(item.expenses / 1000).toFixed(0)}k
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-2">{item.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CHART 2: Customer Growth */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Subscriber Growth</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                    +24% MOM
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Net active subscriber expansion trend</p>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="h-56 sm:h-60 w-full relative flex flex-col justify-end pt-4 pb-2">
              <svg className="w-full h-40 sm:h-44 overflow-visible" viewBox="0 0 500 150">
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="30" x2="500" y2="30" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                <line x1="0" y1="80" x2="500" y2="80" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                <line x1="0" y1="130" x2="500" y2="130" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />

                <polygon
                  points="0,150 0,120 100,100 200,75 300,50 400,35 500,15 500,150"
                  fill="url(#growthGrad)"
                />

                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="0,120 100,100 200,75 300,50 400,35 500,15"
                />

                {[
                  { x: 0, y: 120 },
                  { x: 100, y: 100 },
                  { x: 200, y: 75 },
                  { x: 300, y: 50 },
                  { x: 400, y: 35 },
                  { x: 500, y: 15 },
                ].map((pt, idx) => (
                  <circle key={idx} cx={pt.x} cy={pt.y} r="4.5" fill="#0f172a" stroke="#10b981" strokeWidth="2.5" />
                ))}
              </svg>

              <div className="flex justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-2 px-1">
                {customerGrowthData.map((d) => (
                  <span key={d.month}>{d.month}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doughnut Charts Breakdown */}
      {(user?.role === 'Admin' || hasSectionAccess('reports')) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Connection Status */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Connection Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active / Suspended / Pending ratio</p>
            </div>

            <div className="py-5 flex items-center justify-center relative">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" strokeWidth="14" />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray={`${(activeCustomers / connTotal) * 238} 238`}
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="14"
                  strokeDasharray={`${(suspendedCustomers / connTotal) * 238} 238`}
                  strokeDashoffset={`-${(activeCustomers / connTotal) * 238}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-white">{activeCustomers}</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">Active</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Active Subscribers
                </span>
                <span className="font-bold">{activeCustomers}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Suspended
                </span>
                <span className="font-bold">{suspendedCustomers}</span>
              </div>
            </div>
          </div>

          {/* Revenue by Package */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Revenue by Package</h3>
              <p className="text-xs text-slate-400 mt-0.5">Bandwidth tariff MRR share</p>
            </div>

            <div className="py-5 flex items-center justify-center relative">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" strokeWidth="14" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#06b6d4" strokeWidth="14" strokeDasharray="100 238" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="70 238" strokeDashoffset="-100" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#8b5cf6" strokeWidth="14" strokeDasharray="68 238" strokeDashoffset="-170" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-400">Total MRR</span>
                <span className="text-xs font-black text-cyan-300">Rs. {(monthlyRevenue / 1000).toFixed(0)}k</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              {packageRevenueList.slice(0, 3).map((pkg, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-300">
                  <span className="truncate max-w-[130px]">{pkg.name}</span>
                  <span className="font-bold text-cyan-300 font-mono">Rs. {pkg.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Complaints Overview */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Complaints Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tickets resolution breakdown</p>
            </div>

            <div className="py-5 flex items-center justify-center relative">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" strokeWidth="14" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="14" strokeDasharray="140 238" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="60 238" strokeDashoffset="-140" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray="38 238" strokeDashoffset="-200" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-white">{complaints.length}</span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Solved
                </span>
                <span className="font-bold text-emerald-400">{solvedComplaintsCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> In Progress
                </span>
                <span className="font-bold text-blue-400">{workingComplaintsCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
                </span>
                <span className="font-bold text-amber-400">{pendingComplaintsCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL PACKAGES CARDS */}
      {hasSectionAccess('packages') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" /> Tariff Packages ({allPackages.length})
              </h3>
              <p className="text-xs text-slate-400">Live tariff rates &amp; subscriber count</p>
            </div>
            <button
               type="button"
              onClick={() => setActiveSection('packages')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline"
            >
              All Packages &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {allPackages.map((pkg) => {
              const subs = customers.filter((c) => c.packageId === pkg.id || c.packageName === pkg.name);
              const activeSubs = subs.filter((c) => c.status === 'Active').length;
              const pkgRevenue = subs.reduce((sum, c) => sum + (c.totalMonthly || 0), 0);

              return (
                <div
                  key={pkg.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-700/60 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{pkg.name}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/60 mt-1 inline-block">
                          ⚡ {pkg.speed}
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        Rs. {pkg.price.toLocaleString()}
                        <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                      {pkg.description || `High speed optical fiber bandwidth with 24/7 support.`}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Subscribers</span>
                      <span className="font-bold text-white font-mono">
                        {activeSubs} <span className="text-[10px] text-emerald-400">Active</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Monthly Billing</span>
                      <span className="font-bold text-cyan-300 font-mono">Rs. {pkgRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALL AREAS CARDS */}
      {hasSectionAccess('areas') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" /> Service Coverage Areas ({allAreas.length})
              </h3>
              <p className="text-xs text-slate-400">Fiber distribution nodes &amp; sector subscribers</p>
            </div>
            <button
               type="button"
              onClick={() => setActiveSection('areas')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold underline"
            >
              Manage Areas &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {allAreas.map((area) => {
              const areaCusts = customers.filter((c) => c.areaId === area.id || c.areaName === area.name);
              const activeInArea = areaCusts.filter((c) => c.status === 'Active').length;
              const areaRev = areaCusts.reduce((sum, c) => sum + (c.totalMonthly || 0), 0);

              return (
                <div
                  key={area.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-700/60 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{area.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                          Code: {area.code} &bull; {area.city || 'Pasrur'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                        Zone
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2">
                      📍 Optical Fiber distribution sector with active splitter nodes.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Active Base</span>
                      <span className="font-bold text-emerald-400 font-mono">{activeInArea} users</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Monthly Billing</span>
                      <span className="font-bold text-white font-mono">Rs. {areaRev.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALL STAFF MEMBERS CARDS (Visible to Admin or Staff Management) */}
      {(user?.role === 'Admin' || hasSectionAccess('staff')) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Operational Staff &amp; Linemen ({allStaff.length})
              </h3>
              <p className="text-xs text-slate-400">Team credentials &amp; role assignments</p>
            </div>
            <button
               type="button"
              onClick={() => setActiveSection('staff')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
            >
              Manage Staff &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {allStaff.map((st) => {
              const isOnline = st.status === 'Active';

              return (
                <div
                  key={st.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-700/60 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow">
                          {st.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{st.name}</h4>
                          <span className="text-[10px] text-cyan-400 font-semibold block">{st.role}</span>
                        </div>
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80' : 'bg-slate-600'
                        }`}
                        title={st.status}
                      />
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                      <p className="truncate">📞 {st.phone || st.mobile || '0300-0000000'}</p>
                      <p className="truncate">✉️ {st.email}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Status</span>
                      <span className={`font-bold text-[11px] ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {st.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Permissions</span>
                      <span className="font-bold text-slate-300 font-mono">
                        {st.allowedSections?.length || 0} Modules
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADMIN APPROVALS & NOC ACTION QUEUE */}
      {(user?.role === 'Admin' || hasSectionAccess('deletion-requests') || hasSectionAccess('connections')) && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                <span>🛡️ Admin Approvals &amp; Critical NOC Tasks</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                  {allDeletionRequests.filter((d) => d.status === 'Pending').length +
                    allConnections.filter((c) => c.status === 'Pending').length}{' '}
                  Pending
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Customer deletion requests, new connection feasibilities and low inventory restock orders
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Deletion Approvals */}
            {(user?.role === 'Admin' || hasSectionAccess('deletion-requests')) && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs">Customer Deletion Requests</span>
                    <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold font-mono">
                      {allDeletionRequests.filter((d) => d.status === 'Pending').length} Pending
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Staff deletion tickets requiring Super Admin dual-approval authorization before drop.
                  </p>
                </div>
                <button
                   type="button"
                  onClick={() => setActiveSection('deletion-requests')}
                  className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                >
                  Review Approvals &rarr;
                </button>
              </div>
            )}

            {/* Connection Onboardings */}
            {hasSectionAccess('connections') && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs">New Connection Requests</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-bold font-mono">
                      {connections.filter((c) => c.status === 'Pending').length} Pending
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Incoming FTTH subscriber applications awaiting optical port feasibility check.
                  </p>
                </div>
                <button
                   type="button"
                  onClick={() => setActiveSection('connections')}
                  className="mt-3 w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors"
                >
                  Approve Connections &rarr;
                </button>
              </div>
            )}

            {/* Low Stock Reorders */}
            {hasSectionAccess('inventory') && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-xs">Hardware Stock Alerts</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-bold font-mono">
                      {lowStockCount} Items Low
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Optical fiber patch cords, ONTs and routers below minimum buffer inventory.
                  </p>
                </div>
                <button
                   type="button"
                  onClick={() => setActiveSection('stock-alerts')}
                  className="mt-3 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition-colors"
                >
                  Restock Hardware &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
