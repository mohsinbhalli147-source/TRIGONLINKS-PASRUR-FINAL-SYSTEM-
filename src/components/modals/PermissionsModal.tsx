import React, { useState } from 'react';
import { StaffMember, SectionId, FunctionPermission, ALL_SECTIONS, ALL_FUNCTIONS } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CheckSquare, Square, Save, RotateCcw, Wrench, Headphones, Briefcase } from 'lucide-react';
import { Modal } from '../common/Modal';

interface PermissionsModalProps {
  staff: StaffMember;
  onClose: () => void;
  onSave: (updatedStaff: StaffMember) => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ staff, onClose, onSave }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedSections, setSelectedSections] = useState<SectionId[]>(staff.allowedSections || []);
  const [selectedFunctions, setSelectedFunctions] = useState<FunctionPermission[]>(staff.allowedFunctions || []);

  // Section toggle
  const toggleSection = (id: SectionId) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  // Function toggle
  const toggleFunction = (id: FunctionPermission) => {
    setSelectedFunctions((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  // Presets
  const applyPreset = (preset: 'admin' | 'technician' | 'support' | 'accounts' | 'clear') => {
    if (preset === 'admin') {
      setSelectedSections(ALL_SECTIONS.map((s) => s.id));
      setSelectedFunctions(ALL_FUNCTIONS.map((f) => f.id));
      showToast('info', 'Full Access Preset Applied', 'All 23 sections and 15 functions selected.');
    } else if (preset === 'technician') {
      setSelectedSections([
        'dashboard',
        'customers',
        'connections',
        'complaints',
        'inventory',
        'stock-alerts',
      ]);
      setSelectedFunctions([
        'add_customers',
        'edit_customers',
        'approve_connections',
        'manage_inventory',
      ]);
      showToast('info', 'Technician Preset Applied', 'Field and network operational modules selected.');
    } else if (preset === 'support') {
      setSelectedSections([
        'dashboard',
        'customers',
        'invoices',
        'complaints',
        'messages',
        'announcements',
      ]);
      setSelectedFunctions([
        'edit_customers',
        'receive_payments',
        'send_messages',
        'view_reports',
      ]);
      showToast('info', 'Support Preset Applied', 'Helpdesk and ticketing permissions selected.');
    } else if (preset === 'accounts') {
      setSelectedSections([
        'dashboard',
        'customers',
        'billing',
        'invoices',
        'payments',
        'due-payments',
        'expenses',
        'reports',
      ]);
      setSelectedFunctions([
        'receive_payments',
        'generate_bills',
        'view_reports',
        'export_data',
      ]);
      showToast('info', 'Accounts Preset Applied', 'Billing and recovery modules selected.');
    } else if (preset === 'clear') {
      setSelectedSections(['dashboard']);
      setSelectedFunctions([]);
      showToast('info', 'Cleared Permissions', 'Only default Dashboard access remains.');
    }
  };

  const handleSave = () => {
    const updated: StaffMember = {
      ...staff,
      allowedSections: selectedSections,
      allowedFunctions: selectedFunctions,
    };

    StorageService.saveStaff(updated, user?.email);
    showToast('success', 'Permissions Saved', `Updated RBAC access matrix for ${staff.name}`);
    onSave(updated);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`RBAC Permission Editor • ${staff.name} • ${staff.role}`}
      description="Configure granted navigation sections and executive operational functions"
      size="xl"
    >
        {/* Quick Presets Bar */}
        <div className="py-3 px-1 border-b border-slate-800/80 shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Quick Presets:</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('admin')}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 font-bold flex items-center gap-1.5 transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" /> Full Admin (All 23)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('technician')}
              className="px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-700/50 text-blue-300 font-bold flex items-center gap-1.5 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" /> Technician Preset
            </button>
            <button
              type="button"
              onClick={() => applyPreset('support')}
              className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-700/50 text-purple-300 font-bold flex items-center gap-1.5 transition-colors"
            >
              <Headphones className="w-3.5 h-3.5" /> Support Agent Preset
            </button>
            <button
              type="button"
              onClick={() => applyPreset('accounts')}
              className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/50 text-amber-300 font-bold flex items-center gap-1.5 transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" /> Accounts Preset
            </button>
            <button
              type="button"
              onClick={() => applyPreset('clear')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Default
            </button>
          </div>
        </div>

        {/* Scrollable Body with Two Core Sections: A and B */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {/* PART A: Section Access (23 sections) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold text-sm text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <span>Part A: Section Access</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono">
                  {selectedSections.length} of {ALL_SECTIONS.length} Enabled
                </span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  if (selectedSections.length === ALL_SECTIONS.length) {
                    setSelectedSections(['dashboard']);
                  } else {
                    setSelectedSections(ALL_SECTIONS.map((s) => s.id));
                  }
                }}
                className="text-xs text-cyan-400 hover:underline"
              >
                {selectedSections.length === ALL_SECTIONS.length ? 'Deselect All' : 'Select All 23 Sections'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {ALL_SECTIONS.map((sec) => {
                const isChecked = selectedSections.includes(sec.id);
                return (
                  <div
                    key={sec.id}
                    onClick={() => toggleSection(sec.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-cyan-950/40 border-cyan-700 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-cyan-400">
                      {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div>
                      <p className="font-bold">{sec.name}</p>
                      <p className="text-[10px] text-slate-500">{sec.group}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PART B: Function Permissions (15 functions) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold text-sm text-blue-300 uppercase tracking-wider flex items-center gap-2">
                <span>Part B: Function Permissions</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-mono">
                  {selectedFunctions.length} of {ALL_FUNCTIONS.length} Granted
                </span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  if (selectedFunctions.length === ALL_FUNCTIONS.length) {
                    setSelectedFunctions([]);
                  } else {
                    setSelectedFunctions(ALL_FUNCTIONS.map((f) => f.id));
                  }
                }}
                className="text-xs text-blue-400 hover:underline"
              >
                {selectedFunctions.length === ALL_FUNCTIONS.length ? 'Revoke All' : 'Grant All 15 Functions'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {ALL_FUNCTIONS.map((fn) => {
                const isChecked = selectedFunctions.includes(fn.id);
                return (
                  <div
                    key={fn.id}
                    onClick={() => toggleFunction(fn.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-blue-950/40 border-blue-700 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-blue-400">
                      {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div>
                      <p className="font-bold">{fn.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{fn.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Changes will take effect upon the user&apos;s active session and next sign-in.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
            >
              <Save className="w-4 h-4" />
              Save Permissions
            </button>
          </div>
        </div>
    </Modal>
  );
};
