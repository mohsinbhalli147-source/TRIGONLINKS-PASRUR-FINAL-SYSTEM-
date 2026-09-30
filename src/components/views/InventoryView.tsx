import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollection } from '../../hooks/useStorageCollection';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Package, Plus, Search, AlertTriangle, ArrowUpDown, Edit2, PlusCircle, MinusCircle, PackageCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { RestockModal } from '../modals/RestockModal';

export const InventoryView: React.FC = () => {
  const { user, hasFunctionAccess, setActiveSection } = useAuth();
  const { showToast } = useToast();

  const [inventory, refreshInventory] = useStorageCollection<InventoryItem[]>(
    () => StorageService.getInventory(),
    ['trigon_inventory']
  );

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Restock Modal
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [itemToRestock, setItemToRestock] = useState<InventoryItem | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [quantity, setQuantity] = useState(10);
  const [unitCost, setUnitCost] = useState(2500);
  const [sellingPrice, setSellingPrice] = useState(3500);
  const [minStock, setMinStock] = useState(5);

  const openAdd = () => {

    setEditingItem(null);
    setName('');
    setCategory('Hardware');
    setQuantity(10);
    setUnitCost(2500);
    setSellingPrice(3500);
    setMinStock(5);
    setIsModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category || item.categoryName || 'ONT');
    setQuantity(item.quantity);
    setUnitCost(item.unitCost || item.price || 0);
    setSellingPrice(item.sellingPrice || item.price || 0);
    setMinStock(item.minStock);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingItem) {
      const updated: InventoryItem = {
        ...editingItem,
        name,
        category,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        sellingPrice: Number(sellingPrice),
        minStock: Number(minStock),
      };
      StorageService.saveInventoryItem(updated, user?.email);
      showToast('success', 'Item Updated', `${name} stock record updated.`);
    } else {
      const newItem: InventoryItem = {
        id: `inv-${Date.now()}`,
        name,
        category,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        sellingPrice: Number(sellingPrice),
        minStock: Number(minStock),
        unit: category === 'Cable' ? 'meters' : 'pcs',
      };
      StorageService.saveInventoryItem(newItem, user?.email);
      showToast('success', 'Item Added', `${name} registered in warehouse inventory.`);
    }

    setIsModalOpen(false);
  };

  const handleQuickQtyAdjust = (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    const updated = { ...item, quantity: newQty };
    StorageService.saveInventoryItem(updated, user?.email);
    showToast('info', 'Quantity Updated', `${item.name} quantity adjusted to ${newQty}.`);
  };

  const categories = Array.from(new Set(inventory.map((i) => i.category || i.categoryName || 'General')));

  const filtered = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const itemCat = item.category || item.categoryName;
    const matchesCat = categoryFilter === 'All' || itemCat === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = inventory.filter((i) => i.quantity <= i.minStock).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            Hardware &amp; Equipment Warehouse Stock
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time inventory levels for GPON ONTs, optical cables, fast connectors, and splitters
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lowStockCount > 0 && (
            <button
               type="button"
              onClick={() => setActiveSection('stock-alerts')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 font-bold text-xs hover:bg-rose-900 transition-colors animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowStockCount} Low Stock Alerts &rarr;
            </button>
          )}

          <button
             type="button"
            onClick={() => {
              setItemToRestock(null);
              setIsRestockModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02]"
          >
            <PackageCheck className="w-4 h-4" />
            + Restock Equipment
          </button>

          <button
             type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
          >
            <Plus className="w-4 h-4" />
            + Add Equipment
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, models, serial numbers..."
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

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Item Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">In Stock</th>
                <th className="py-3.5 px-4 text-center">Min Threshold</th>
                <th className="py-3.5 px-4 text-right">Cost (PKR)</th>
                <th className="py-3.5 px-4 text-right">Billing Rate (PKR)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Adjust Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((item) => {
                const isLow = item.quantity <= item.minStock;

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                        {item.category || item.categoryName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-sm">
                      <span className={isLow ? 'text-rose-400' : 'text-white'}>
                        {item.quantity} {item.unit || 'pcs'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {item.minStock} {item.unit || 'pcs'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      Rs. {(item.unitCost || item.price || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                      Rs. {(item.sellingPrice || item.price || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isLow
                            ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {isLow ? 'Low Stock' : 'Optimal'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                           type="button"
                          onClick={() => {
                            setItemToRestock(item);
                            setIsRestockModalOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-bold text-[11px] transition-colors"
                          title="Restock Item & Purchase"
                        >
                          + Restock
                        </button>
                        <button
                           type="button"
                          onClick={() => handleQuickQtyAdjust(item, 1)}
                          className="p-1 rounded text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                          title="Add +1 unit"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                        <button
                           type="button"
                          onClick={() => handleQuickQtyAdjust(item, -1)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="Deduct -1 unit"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                        <button
                           type="button"
                          onClick={() => openEdit(item)}
                          className="p-1 text-slate-400 hover:text-cyan-400 ml-1"
                          title="Edit Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No inventory records found.
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
          title={editingItem ? 'Edit Hardware Item' : 'Add Warehouse Hardware'}
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label htmlFor="equipment-name" className="block text-slate-300 font-bold mb-1">Equipment Name *</label>
                <input
                   id="equipment-name"
                  type="text"
                  required
                  placeholder="e.g. Huawei Dual-Band GPON ONT"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="inventory-item-category" className="block text-slate-300 font-bold mb-1">Category</label>
                <select
                   id="inventory-item-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Hardware">Hardware / Terminal</option>
                  <option value="Cable">Fiber Cable / Wire</option>
                  <option value="Accessory">Accessory / Connector</option>
                  <option value="Optical">Optical Splitter / SFP</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="quantity" className="block text-slate-300 font-bold mb-1">Quantity *</label>
                  <input
                     id="quantity"
                    type="number"
                    required
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="min-alert-stock" className="block text-slate-300 font-bold mb-1">Min Alert Stock *</label>
                  <input
                     id="min-alert-stock"
                    type="number"
                    required
                    min={1}
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="unit-cost" className="block text-slate-300 font-bold mb-1">Unit Cost (PKR) *</label>
                  <input
                     id="unit-cost"
                    type="number"
                    required
                    min={0}
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="billing-price" className="block text-slate-300 font-bold mb-1">Billing Price (PKR) *</label>
                  <input
                     id="billing-price"
                    type="number"
                    required
                    min={0}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
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
                  Save Item
                </button>
              </div>
            </form>
        </Modal>
      )}
      {/* Dedicated Restock Modal */}
      {isRestockModalOpen && (
        <RestockModal
          initialItem={itemToRestock}
          onClose={() => {
            setIsRestockModalOpen(false);
            setItemToRestock(null);
          }}
          onSuccess={() => {
            refreshInventory();
          }}

        />
      )}
    </div>
  );
};

