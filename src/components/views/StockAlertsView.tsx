import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle,
  Plus,
  PackageCheck,
  Building2,
  Calendar,
  Receipt,
  Layers,
  History,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { RestockModal } from '../modals/RestockModal';

export const StockAlertsView: React.FC = () => {
  const { user, setActiveSection } = useAuth();
  const { showToast } = useToast();

  const [{ inventory, restockLogs }, refreshData] = useStorageCollections({
    inventory: () => StorageService.getInventory(),
    restockLogs: () => StorageService.getRestockLogs(),
  });
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');

  // Restock Modal
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [itemToRestock, setItemToRestock] = useState<InventoryItem | null>(null);

  const lowStock = inventory.filter((i) => i.quantity <= i.minStock);

  const openRestockModal = (item?: InventoryItem) => {
    setItemToRestock(item || null);
    setIsRestockModalOpen(true);
  };

  const handleRestockSuccess = () => {
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            Stock Alerts &amp; Restock Procurement
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor critical warehouse inventory deficits, issue vendor purchase orders, and record incoming stock
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
             type="button"
            onClick={() => setActiveSection('inventory')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
          >
            All Inventory Stock &rarr;
          </button>

          <button
             type="button"
            onClick={() => openRestockModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            + New Restock &amp; Purchase Entry
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-bold">
        <button
           type="button"
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'alerts'
              ? 'bg-rose-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Low Stock Alerts</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] ${
            activeTab === 'alerts' ? 'bg-slate-950 text-rose-300 font-mono' : 'bg-slate-800 text-rose-400'
          }`}>
            {lowStock.length}
          </span>
        </button>

        <button
           type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'history'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Restock Purchase History</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] ${
            activeTab === 'history' ? 'bg-slate-950 text-cyan-300 font-mono' : 'bg-slate-800 text-cyan-400'
          }`}>
            {restockLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: LOW STOCK ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {lowStock.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center">
              <PackageCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">All Warehouse Inventories Above Threshold</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No equipment is currently running low. Optical cables, ONTs, routers, and patch cords are at safe stock levels.
              </p>
              <button
                 type="button"
                onClick={() => openRestockModal()}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Add Restock In Advance
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lowStock.map((item) => {
                const deficit = Math.max(0, item.minStock - item.quantity);
                return (
                  <div
                    key={item.id}
                    className="p-6 rounded-3xl bg-slate-900 border-2 border-rose-900/60 shadow-xl flex flex-col justify-between hover:border-rose-700/80 transition-all group"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                          CRITICAL LOW STOCK
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {item.category || item.categoryName || 'Equipment'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white mt-3 group-hover:text-cyan-300 transition-colors">
                        {item.name}
                      </h3>

                      <div className="mt-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-3 text-center text-xs">
                        <div className="p-2 rounded-xl bg-rose-950/30 border border-rose-900/40">
                          <span className="text-[10px] text-rose-300 uppercase font-semibold">Remaining Stock</span>
                          <p className="text-2xl font-black text-rose-400 mt-0.5 font-mono">
                            {item.quantity} <span className="text-xs font-normal text-rose-300">{item.unit || 'pcs'}</span>
                          </p>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Min Safety Limit</span>
                          <p className="text-2xl font-black text-slate-300 mt-0.5 font-mono">
                            {item.minStock} <span className="text-xs font-normal text-slate-400">{item.unit || 'pcs'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs text-slate-400">
                        <div className="flex items-center justify-between">
                          <span>Est. Unit Purchase Cost:</span>
                          <span className="font-mono font-bold text-blue-400">
                            Rs. {(item.unitCost || item.price || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Supplier:</span>
                          <span className="font-semibold text-slate-300 truncate max-w-[150px]">
                            {item.supplier || 'Huawei Vendor'}
                          </span>
                        </div>
                        {deficit > 0 && (
                          <div className="flex items-center justify-between text-rose-400 pt-1 border-t border-slate-900">
                            <span>Deficit to Safety Limit:</span>
                            <span className="font-bold font-mono">-{deficit} {item.unit || 'pcs'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800">
                      <button
                         type="button"
                        onClick={() => openRestockModal(item)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-md shadow-emerald-950/40 hover:scale-[1.02] transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Restock Item &amp; Purchase Entry &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESTOCK & PURCHASE LOGS HISTORY */}
      {activeTab === 'history' && (
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                Hardware Purchase &amp; Receiving Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Complete audit trail of all warehouse stock inflows, supplier invoices, unit rates, and expense allocations
              </p>
            </div>

            <button
               type="button"
              onClick={() => openRestockModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-bold text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Purchase Entry
            </button>
          </div>

          {restockLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs italic">
              No restock purchases recorded yet. Click &quot;New Restock &amp; Purchase Entry&quot; to log your first supplier delivery.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Equipment Item</th>
                    <th className="py-3 px-4 text-center">Qty Added</th>
                    <th className="py-3 px-4">Unit Cost</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Supplier &amp; PO #</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {restockLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {log.date}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        <div>{log.itemName}</div>
                        <span className="text-[10px] text-slate-500 font-normal">{log.category}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-black font-mono">
                          +{log.quantityAdded}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        Rs. {log.unitCost.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-cyan-400">
                        Rs. {log.totalCost.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{log.supplier}</div>
                        <span className="text-[10px] text-slate-500 font-mono">PO: {log.invoiceNumber || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {log.paymentMethod || 'Bank'}
                        </span>
                        {log.autoExpenseCreated && (
                          <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-900">
                            Expense Logged
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 truncate max-w-[120px] font-mono text-[11px]">
                        {log.recordedBy?.split('@')[0] || 'admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FULL RESTOCK / PURCHASE MODAL */}
      {isRestockModalOpen && (
        <RestockModal
          initialItem={itemToRestock}
          onClose={() => {
            setIsRestockModalOpen(false);
            setItemToRestock(null);
          }}
          onSuccess={handleRestockSuccess}
        />
      )}
    </div>
  );
};
