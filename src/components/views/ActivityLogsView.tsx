import React, { useState } from 'react';
import { ActivityLog } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollection } from '../../hooks/useStorageCollection';
import { ShieldCheck, Search, Filter, History, Clock } from 'lucide-react';

export const ActivityLogsView: React.FC = () => {
  const [logs] = useStorageCollection<ActivityLog[]>(
    () => StorageService.getActivityLogs(),
    ['trigon_activity']
  );
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('All');

  const sections = Array.from(
    new Set(logs.map((l) => l.section).filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim().length > 0)))
  );

  const filtered = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchesSec = sectionFilter === 'All' || log.section === sectionFilter;
    return matchesSearch && matchesSec;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            System Audit Trail &amp; Activity Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of all user transactions, customer status alterations, permissions, and payment collections
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700">
          {logs.length} Total Audit Records
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, user, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Section:</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          >
            <option value="All">All Modules</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
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
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Module</th>
                <th className="py-3.5 px-4">Operation / Action</th>
                <th className="py-3.5 px-4">Transaction Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <p className="font-bold text-white">{log.userName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{log.userEmail}</p>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                      {log.section}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-cyan-300 whitespace-nowrap">{log.action}</td>
                  <td className="py-3 px-4 text-slate-300 text-xs">{log.details}</td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No activity records found.
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
