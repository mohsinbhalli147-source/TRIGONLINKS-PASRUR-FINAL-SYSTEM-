import React, { useState, useMemo } from 'react';
import { Area, Customer } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  MapPin,
  Plus,
  Users,
  Wrench,
  Search,
  Edit2,
  Trophy,
  Award,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  FileText,
  DollarSign,
  ArrowUpRight,
  Filter,
  Layers,
  Sparkles,
  Percent,
  Download,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const AreasView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [{ areas, staff, customers, invoices }] = useStorageCollections({
    areas: () => StorageService.getAreas(),
    staff: () => StorageService.getStaff(),
    customers: () => StorageService.getCustomers(),
    invoices: () => StorageService.getInvoices(),
  });
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedAreaForReport, setSelectedAreaForReport] = useState<Area | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('Pasrur');
  const [technicianId, setTechnicianId] = useState('');

  const openAdd = () => {
    setEditingArea(null);
    setName('');
    setCity('Pasrur');
    setTechnicianId(staff.find((s) => s.role === 'Technician')?.id || '');
    setIsModalOpen(true);
  };

  const openEdit = (a: Area) => {
    setEditingArea(a);
    setName(a.name);
    setCity(a.city || 'Pasrur');
    setTechnicianId(a.assignedTechnicianId || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const techName = staff.find((s) => s.id === technicianId)?.name;

    if (editingArea) {
      const updated: Area = {
        ...editingArea,
        name,
        city,
        assignedTechnicianId: technicianId,
        assignedTechnicianName: techName,
      };
      StorageService.saveArea(updated, user?.email);
      showToast('success', 'Area Updated', `Coverage zone ${name} updated.`);
    } else {
      const newArea: Area = {
        id: `area-${Date.now()}`,
        name,
        city,
        assignedTechnicianId: technicianId,
        assignedTechnicianName: techName,
        customerCount: 0,
        activeComplaints: 0,
      };
      StorageService.saveArea(newArea, user?.email);
      showToast('success', 'Area Added', `New coverage zone ${name} added to network.`);
    }

    setIsModalOpen(false);
  };

  // Comprehensive Area Financial & Operational Analytics
  const areaAnalytics = useMemo(() => {
    const stats = areas.map((area) => {
      const areaCusts = customers.filter((c) => c.areaId === area.id);
      const activeCount = areaCusts.filter((c) => c.status === 'Active').length;
      const suspendedCount = areaCusts.filter((c) => c.status === 'Suspended').length;

      const custIds = new Set(areaCusts.map((c) => c.id));
      const areaInvoices = invoices.filter((inv) => custIds.has(inv.customerId));

      const invBilled = areaInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      const invReceived = areaInvoices
        .filter((inv) => inv.status === 'Paid')
        .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      const invPending = areaInvoices
        .filter((inv) => inv.status === 'Unpaid' || inv.status === 'Partial')
        .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

      const customerLedgerPending = areaCusts.reduce((sum, c) => sum + (Number(c.pendingBalance) || 0), 0);
      const effectivePending = invPending > 0 ? invPending : customerLedgerPending;

      // Monthly recurring demand
      const monthlyDemand = areaCusts.reduce((sum, c) => sum + (Number(c.totalMonthly || c.monthlyFee) || 0), 0);
      const effectiveBilled = invBilled > 0 ? invBilled : monthlyDemand;

      const recoveryRate = effectiveBilled > 0 ? Math.min(100, Math.round((invReceived / effectiveBilled) * 100)) : 0;

      return {
        area,
        customers: areaCusts,
        invoices: areaInvoices,
        totalCustomers: areaCusts.length,
        activeCount,
        suspendedCount,
        totalBilled: effectiveBilled,
        totalReceived: invReceived,
        totalPending: effectivePending,
        recoveryRate,
        monthlyDemand,
      };
    });

    // Sort by total received / customers to determine competitive rank
    const sorted = [...stats].sort((a, b) => b.totalReceived - a.totalReceived || b.totalCustomers - a.totalCustomers);

    const rankedMap = new Map<string, number>();
    sorted.forEach((item, index) => {
      rankedMap.set(item.area.id, index + 1);
    });

    return stats.map((item) => ({
      ...item,
      rank: rankedMap.get(item.area.id) || 1,
      isTopLeader: rankedMap.get(item.area.id) === 1,
    }));
  }, [areas, customers, invoices]);

  // Overall totals across all areas
  const networkTotals = useMemo(() => {
    return areaAnalytics.reduce(
      (acc, curr) => ({
        customers: acc.customers + curr.totalCustomers,
        active: acc.active + curr.activeCount,
        suspended: acc.suspended + curr.suspendedCount,
        billed: acc.billed + curr.totalBilled,
        received: acc.received + curr.totalReceived,
        pending: acc.pending + curr.totalPending,
      }),
      { customers: 0, active: 0, suspended: 0, billed: 0, received: 0, pending: 0 }
    );
  }, [areaAnalytics]);

  const topArea = useMemo(() => {
    return areaAnalytics.find((a) => a.rank === 1);
  }, [areaAnalytics]);

  const filteredAnalytics = useMemo(() => {
    return areaAnalytics.filter(
      (item) =>
        item.area.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.area.city?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (item.area.assignedTechnicianName?.toLowerCase() || '').includes(search.toLowerCase())
    );
  }, [areaAnalytics, search]);

  const selectedAreaData = useMemo(() => {
    if (!selectedAreaForReport) return null;
    return areaAnalytics.find((a) => a.area.id === selectedAreaForReport.id);
  }, [areaAnalytics, selectedAreaForReport]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-cyan-400" />
            Area Coverage &amp; Performance Intelligence Report
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full comprehensive reporting per sector: customers, billed amount, collected revenue, pending balances, and competitive rankings
          </p>
        </div>

        <button
           type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
        >
          <Plus className="w-4 h-4" />
          + Add Area
        </button>
      </div>

      {/* Network High-Impact Executive Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Coverage Zones
          </span>
          <p className="text-2xl font-black text-white mt-1">{areas.length}</p>
          <span className="text-[10px] text-slate-500">Active distribution sectors</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Total Subscribers
          </span>
          <p className="text-2xl font-black text-white mt-1 font-mono">{networkTotals.customers}</p>
          <span className="text-[10px] text-emerald-400 font-medium">
            {networkTotals.active} Active | {networkTotals.suspended} Suspended
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-purple-400" />
            Total Billed
          </span>
          <p className="text-2xl font-black text-white mt-1 font-mono">
            Rs. {networkTotals.billed.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Across all network zones</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 shadow-lg">
          <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Total Received (Paid)
          </span>
          <p className="text-2xl font-black text-emerald-300 mt-1 font-mono">
            Rs. {networkTotals.received.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-400 font-bold">
            {networkTotals.billed > 0
              ? Math.round((networkTotals.received / networkTotals.billed) * 100)
              : 100}
            % Overall Recovery Rate
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 shadow-lg col-span-2 lg:col-span-1">
          <span className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Total Pending Bills
          </span>
          <p className="text-2xl font-black text-rose-300 mt-1 font-mono">
            Rs. {networkTotals.pending.toLocaleString()}
          </p>
          <span className="text-[10px] text-rose-400 font-medium">Outstanding recovery</span>
        </div>
      </div>

      {/* Top Leader Spotlight Banner ("Konsa Agy Hy Dosroon Sy") */}
      {topArea && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950/40 border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-950/50">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> #1 Top Leading Sector
                </span>
                <span className="text-xs text-slate-400 font-mono">Ahead of all network zones</span>
              </div>
              <h3 className="text-lg font-black text-white mt-0.5">
                {topArea.area.name} ({topArea.area.city})
              </h3>
              <p className="text-xs text-slate-300">
                Leading with <span className="text-amber-300 font-bold">{topArea.totalCustomers} Customers</span>,{' '}
                <span className="text-emerald-400 font-bold font-mono">Rs. {topArea.totalReceived.toLocaleString()} Collected</span> ({topArea.recoveryRate}% Recovery Rate).
              </p>
            </div>
          </div>

          <button
             type="button"
            onClick={() => setSelectedAreaForReport(topArea.area)}
            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-all self-end md:self-auto"
          >
            <BarChart3 className="w-4 h-4" />
            View Leader Dossier
          </button>
        </div>
      )}

      {/* Filter and View Mode Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search zones, towns, technicians, rankings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-slate-400 font-semibold">{filteredAnalytics.length} Coverage Zones</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
               type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
               type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Audit Table
            </button>
          </div>
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAnalytics.map((item) => {
            const { area, rank, isTopLeader, totalCustomers, activeCount, suspendedCount, totalBilled, totalReceived, totalPending, recoveryRate } = item;

            return (
              <div
                key={area.id}
                className={`p-5 rounded-2xl bg-slate-900 border transition-all shadow-xl flex flex-col justify-between group relative ${
                  isTopLeader
                    ? 'border-amber-500/60 shadow-amber-950/20'
                    : rank === 2
                    ? 'border-slate-600'
                    : rank === 3
                    ? 'border-amber-800/60'
                    : 'border-slate-800 hover:border-cyan-800/80'
                }`}
              >
                <div>
                  {/* Top Bar: Title & Rank */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {isTopLeader ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-400" /> Rank #1 Leader
                          </span>
                        ) : rank <= 3 ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1">
                            <Award className="w-3 h-3 text-cyan-400" /> Rank #{rank}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-semibold">
                            Rank #{rank}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{area.city}</span>
                      </div>
                      <h3 className="font-bold text-white text-lg mt-1 group-hover:text-cyan-400 transition-colors">
                        {area.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                         type="button"
                        onClick={() => openEdit(area)}
                        className="text-slate-500 hover:text-cyan-400 p-1 rounded hover:bg-slate-800"
                        title="Edit zone"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Financial Report Numbers */}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Billed</span>
                      <p className="font-mono font-bold text-white text-xs mt-0.5 truncate">
                        Rs. {totalBilled.toLocaleString()}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60">
                      <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Received</span>
                      <p className="font-mono font-black text-emerald-300 text-xs mt-0.5 truncate">
                        Rs. {totalReceived.toLocaleString()}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60">
                      <span className="text-[10px] text-rose-400 uppercase font-semibold block">Pending</span>
                      <p className="font-mono font-bold text-rose-300 text-xs mt-0.5 truncate">
                        Rs. {totalPending.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Recovery Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Recovery Health</span>
                      <span className="font-mono font-bold text-emerald-400">{recoveryRate}% Collected</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, recoveryRate))}%` }}
                      />
                    </div>
                  </div>

                  {/* Subscriber & Lineman Breakdown */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3 text-cyan-400" /> Subscribers
                      </span>
                      <p className="text-sm font-black text-white mt-0.5 font-mono">
                        {totalCustomers}
                        <span className="text-[11px] text-emerald-400 font-normal ml-1 font-sans">
                          ({activeCount} Act | {suspendedCount} Susp)
                        </span>
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-400" /> Lineman
                      </span>
                      <p className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                        {area.assignedTechnicianName || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Action Button */}
                <button
                   type="button"
                  onClick={() => setSelectedAreaForReport(area)}
                  className="mt-4 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  View Full Area Report
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Rank &amp; Area</th>
                  <th className="px-4 py-3">City / Sector</th>
                  <th className="px-4 py-3 text-center">Subscribers</th>
                  <th className="px-4 py-3 text-right">Total Billed</th>
                  <th className="px-4 py-3 text-right">Received (Paid)</th>
                  <th className="px-4 py-3 text-right">Pending Balance</th>
                  <th className="px-4 py-3 text-center">Recovery %</th>
                  <th className="px-4 py-3">Assigned Lineman</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredAnalytics.map((item) => (
                  <tr key={item.area.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-sans">
                      <div className="flex items-center gap-2">
                        {item.isTopLeader ? (
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs">
                            🥇
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-xs">
                            #{item.rank}
                          </span>
                        )}
                        <span className="font-bold text-white">{item.area.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">{item.area.city}</td>
                    <td className="px-4 py-3 text-center font-bold text-white">
                      {item.totalCustomers}{' '}
                      <span className="text-[10px] text-emerald-400 font-normal">({item.activeCount} active)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-200">
                      Rs. {item.totalBilled.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      Rs. {item.totalReceived.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-400">
                      Rs. {item.totalPending.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] ${
                          item.recoveryRate >= 80
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {item.recoveryRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">
                      {item.area.assignedTechnicianName || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                         type="button"
                        onClick={() => setSelectedAreaForReport(item.area)}
                        className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-bold"
                      >
                        Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL AREA DEEP-DIVE REPORT MODAL */}
      {selectedAreaData && (
        <Modal
          isOpen
          onClose={() => setSelectedAreaForReport(null)}
          title={`${selectedAreaData.area.name} — Full Operational & Financial Report`}
          description={`City: ${selectedAreaData.area.city} | Assigned Technician: ${selectedAreaData.area.assignedTechnicianName || 'Unassigned'}`}
          size="lg"
          footer={
            <button
              type="button"
              onClick={() => setSelectedAreaForReport(null)}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close Report
            </button>
          }
        >
          <div className="space-y-6">
            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/40">
                  Sector Performance Dossier
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Rank #{selectedAreaData.rank} of {areas.length} Areas
                </span>
              </div>
            </div>

            {/* 4 Financial Highlight Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold font-sans block">Subscribers</span>
                <p className="text-lg font-black text-white mt-1">
                  {selectedAreaData.totalCustomers}
                </p>
                <span className="text-[10px] text-emerald-400 font-sans">
                  {selectedAreaData.activeCount} Active | {selectedAreaData.suspendedCount} Suspended
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold font-sans block">Total Billed</span>
                <p className="text-lg font-black text-white mt-1">
                  Rs. {selectedAreaData.totalBilled.toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500 font-sans">Gross Demand</span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold font-sans block">Total Received</span>
                <p className="text-lg font-black text-emerald-300 mt-1">
                  Rs. {selectedAreaData.totalReceived.toLocaleString()}
                </p>
                <span className="text-[10px] text-emerald-400 font-sans">
                  {selectedAreaData.recoveryRate}% Recovery Rate
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80">
                <span className="text-[10px] text-rose-400 uppercase font-semibold font-sans block">Total Pending</span>
                <p className="text-lg font-black text-rose-300 mt-1">
                  Rs. {selectedAreaData.totalPending.toLocaleString()}
                </p>
                <span className="text-[10px] text-rose-400 font-sans">Overdue Recovery</span>
              </div>
            </div>

            {/* Customer Roster in this area */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Subscribers in this Area ({selectedAreaData.customers.length})
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Monthly Tariff: Rs. {selectedAreaData.monthlyDemand.toLocaleString()}
                </span>
              </div>

              {selectedAreaData.customers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  No customers currently assigned to this area.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Customer Name</th>
                        <th className="px-3 py-2">Username</th>
                        <th className="px-3 py-2">Package</th>
                        <th className="px-3 py-2 text-right">Monthly Fee</th>
                        <th className="px-3 py-2 text-right">Pending Balance</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {selectedAreaData.customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/50">
                          <td className="px-3 py-2 text-white font-sans font-medium">{c.name}</td>
                          <td className="px-3 py-2 text-cyan-300">{c.username}</td>
                          <td className="px-3 py-2 font-sans text-slate-300">{c.packageName}</td>
                          <td className="px-3 py-2 text-right text-slate-200">
                            Rs. {(c.totalMonthly || c.monthlyFee).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-rose-400 font-bold">
                            Rs. {(c.pendingBalance || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center font-sans">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === 'Active'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Area Modal */}
      {isModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsModalOpen(false)}
          title={editingArea ? 'Edit Coverage Zone' : 'Add New Coverage Zone'}
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label htmlFor="zone-sector-name" className="block text-slate-300 font-bold mb-1">Zone / Sector Name *</label>
                <input
                   id="zone-sector-name"
                  type="text"
                  required
                  placeholder="e.g. Pasrur City or Mohalla Kotli"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-slate-300 font-bold mb-1">City *</label>
                <input
                   id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="assigned-field-technician" className="block text-slate-300 font-bold mb-1">Assigned Field Technician</label>
                <select
                   id="assigned-field-technician"
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">None / Floating Team</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
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
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-950/40"
                >
                  Save Zone
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
};
