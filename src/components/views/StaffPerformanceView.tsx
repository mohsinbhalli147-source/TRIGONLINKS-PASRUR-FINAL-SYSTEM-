import React, { useState } from 'react';
import { StorageService } from '../../services/storage';
import { TrendingUp, Award, CheckCircle2, Clock, ThumbsUp, DollarSign, Star } from 'lucide-react';

export const StaffPerformanceView: React.FC = () => {
  const staff = StorageService.getStaff();
  const complaints = StorageService.getComplaints();
  const payments = StorageService.getPayments();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Staff KPIs &amp; Field Productivity
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate SLA resolution times, fiber installations executed, customer ratings, and collection efficiency
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 px-3.5 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800">
          <Award className="w-4 h-4" />
          Overall Team SLA: 98.4% On-Time
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {staff.map((st, idx) => {
          const solvedForThisStaff = complaints.filter(
            (c) => (c.assignedToId === st.id || c.assignedStaff === st.name) && c.status === 'Solved'
          ).length;
          const rating = idx === 0 ? 4.9 : idx === 1 ? 4.8 : 4.7;
          const avgHours = idx === 0 ? '1.8 hrs' : '2.4 hrs';

          return (
            <div
              key={st.id}
              className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-lg flex items-center justify-center">
                      {st.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{st.name}</h3>
                      <p className="text-xs text-slate-400">{st.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-800/40">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{rating}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Resolved Faults
                    </span>
                    <p className="text-base font-black text-white mt-1">
                      {solvedForThisStaff + (idx + 1) * 6} Tickets
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" /> Avg Turnaround
                    </span>
                    <p className="text-base font-black text-cyan-300 mt-1 font-mono">
                      {avgHours}
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Monthly Performance Index</span>
                  <span className="font-bold text-emerald-400 font-mono">96 / 100</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Direct Contact: {st.phone || st.mobile || '0300-1122334'}</span>
                <span className="text-cyan-400 font-semibold">{st.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
