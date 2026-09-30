import React, { useState } from 'react';
import { Complaint, Customer } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AlertCircle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  Phone,
  User,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const ComplaintsView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [{ complaints, customers, staff }] = useStorageCollections({
    complaints: () => StorageService.getComplaints(),
    customers: () => StorageService.getCustomers(),
    staff: () => StorageService.getStaff(),
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // New Complaint Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Complaint['priority']>('Medium');
  const [assignedStaffId, setAssignedStaffId] = useState('');

  // Resolve Modal
  const [resolvingComplaint, setResolvingComplaint] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const openAdd = () => {
    const defaultCust = customers[0];
    setSelectedCustomerId(defaultCust?.id || '');
    setSubject('Red LOS indicator blinking on ONT');
    setDescription('');
    setPriority('High');
    setAssignedStaffId(staff.find((s) => s.role === 'Technician')?.id || '');
    setIsModalOpen(true);
  };

  const handleCreateComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) return;

    const assignedStaff = staff.find((s) => s.id === assignedStaffId);

    const newComp: Complaint = {
      id: `comp-${Date.now()}`,
      ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: cust.id,
      customerName: cust.name,
      customerMobile: cust.mobile,
      areaName: cust.areaName,
      subject,
      description,
      priority,
      status: 'Pending',
      assignedToId: assignedStaff?.id,
      assignedToName: assignedStaff?.name,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    StorageService.saveComplaint(newComp, user?.email);
    showToast('success', 'Complaint Registered', `Ticket #${newComp.ticketNumber} created for ${cust.name}`);
    setIsModalOpen(false);
  };

  const handleUpdateStatus = (comp: Complaint, newStatus: Complaint['status']) => {
    if (newStatus === 'Solved') {
      setResolvingComplaint(comp);
      setResolutionNotes('Fiber spliced at distribution box; optical power restored to -19 dBm.');
      return;
    }

    const updated: Complaint = {
      ...comp,
      status: newStatus,
    };
    StorageService.saveComplaint(updated, user?.email);
    showToast('info', `Ticket Marked ${newStatus}`, `Ticket #${comp.ticketNumber} updated to ${newStatus}.`);
  };

  const handleConfirmResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingComplaint) return;

    const updated: Complaint = {
      ...resolvingComplaint,
      status: 'Solved',
      resolutionNotes,
      resolvedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    StorageService.saveComplaint(updated, user?.email);
    showToast('success', 'Ticket Resolved', `Ticket #${resolvingComplaint.ticketNumber} resolved successfully.`);
    setResolvingComplaint(null);
  };

  const filtered = complaints.filter((c) => {
    const matchesSearch =
      c.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (c.subject?.toLowerCase() || c.description.toLowerCase()).includes(search.toLowerCase()) ||
      c.customerMobile.includes(search);
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            Subscriber Complaints &amp; Technical Helpdesk
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Log optical fiber faults, line impairments, Wi-Fi router issues, and field dispatch
          </p>
        </div>

        <button
           type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
        >
          <Plus className="w-4 h-4" />
          + Log Complaint
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search ticket #, customer, fault description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Only</option>
              <option value="Working">Working / In Progress</option>
              <option value="Solved">Solved / Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Ticket #</th>
                <th className="py-3.5 px-4">Subscriber</th>
                <th className="py-3.5 px-4">Fault Description</th>
                <th className="py-3.5 px-4">Assigned Lineman</th>
                <th className="py-3.5 px-4 text-center">Priority</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((comp) => (
                <tr key={comp.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-cyan-300">#{comp.ticketNumber}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{comp.createdAt}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-white">{comp.customerName}</p>
                    <p className="text-[11px] text-slate-400">{comp.customerMobile} &bull; {comp.areaName}</p>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="font-bold text-slate-200">{comp.subject}</p>
                    {comp.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{comp.description}</p>
                    )}
                    {comp.resolutionNotes && (
                      <p className="text-[10px] text-emerald-400 mt-0.5 italic">Resolved: {comp.resolutionNotes}</p>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-slate-300 font-semibold">{comp.assignedToName || 'Unassigned'}</span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        comp.priority === 'Critical'
                          ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                          : comp.priority === 'High'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {comp.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        comp.status === 'Solved'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : comp.status === 'Working'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                      }`}
                    >
                      {comp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {comp.status === 'Pending' && (
                        <button
                           type="button"
                          onClick={() => handleUpdateStatus(comp, 'Working')}
                          className="px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-300 font-bold text-[11px]"
                        >
                          Start Working
                        </button>
                      )}
                      {comp.status !== 'Solved' && (
                        <button
                           type="button"
                          onClick={() => handleUpdateStatus(comp, 'Solved')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-[11px] flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Mark Solved
                        </button>
                      )}
                      {comp.status === 'Solved' && (
                        <span className="text-[11px] text-emerald-400 font-semibold">Closed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No complaints found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Complaint Modal */}
      {isModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsModalOpen(false)}
          title="Log Subscriber Technical Fault Ticket"
          size="lg"
        >
          <form onSubmit={handleCreateComplaint} className="space-y-4 text-xs">
            <div>
              <label htmlFor="select-subscriber" className="block text-slate-300 font-bold mb-1">Select Subscriber *</label>
              <select
                 id="select-subscriber"
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} &bull; {c.mobile} &bull; {c.areaName} ({c.packageName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fault-subject-category" className="block text-slate-300 font-bold mb-1">Fault Subject / Category *</label>
              <select
                 id="fault-subject-category"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="Red LOS indicator blinking on ONT (Fiber Break)">Red LOS indicator blinking on ONT (Fiber Break)</option>
                <option value="No Internet Connection (PON unauthenticated)">No Internet Connection (PON unauthenticated)</option>
                <option value="High Ping / Packet Drop / Gaming Latency">High Ping / Packet Drop / Gaming Latency</option>
                <option value="Slow Speed below subscribed package tier">Slow Speed below subscribed package tier</option>
                <option value="ONT Device Damaged / Adapter Burned">ONT Device Damaged / Adapter Burned</option>
                <option value="IPTV Buffering / Channels Glitching">IPTV Buffering / Channels Glitching</option>
                <option value="General Inquiry / Password Change">General Inquiry / Password Change</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="priority-level" className="block text-slate-300 font-bold mb-1">Priority Level</label>
                <select
                   id="priority-level"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label htmlFor="assign-lineman-field-tech" className="block text-slate-300 font-bold mb-1">Assign Lineman / Field Tech</label>
                <select
                   id="assign-lineman-field-tech"
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="additional-symptoms-notes" className="block text-slate-300 font-bold mb-1">Additional Symptoms &amp; Notes</label>
              <textarea
                 id="additional-symptoms-notes"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Customer reports optical wire snapped due to municipal pole maintenance..."
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
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-lg shadow-cyan-950/40"
              >
                Create Ticket
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Resolution Notes Modal */}
      {resolvingComplaint && (
        <Modal
          isOpen
          onClose={() => setResolvingComplaint(null)}
          title={`Resolve Ticket #${resolvingComplaint.ticketNumber}`}
          description={`Enter resolution details for subscriber ${resolvingComplaint.customerName}`}
        >
          <form onSubmit={handleConfirmResolve} className="space-y-4 text-xs">
            <div>
              <label htmlFor="resolution-summary-action-taken" className="block text-slate-300 font-bold mb-1">Resolution Summary / Action Taken *</label>
              <textarea
                 id="resolution-summary-action-taken"
                required
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingComplaint(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-950/40"
              >
                Confirm Resolution
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
