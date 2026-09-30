import React, { useState, useEffect } from 'react';
import { InventoryItem, RestockRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  DollarSign,
  Calendar,
  Building2,
  FileText,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  Receipt,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface RestockModalProps {
  initialItem?: InventoryItem | null;
  onClose: () => void;
  onSuccess: (record: RestockRecord) => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  initialItem,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(StorageService.getInventory());

  // Mode: existing vs new item
  const [isNewItem, setIsNewItem] = useState<boolean>(!initialItem);
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItem?.id || '');

  // New Item Details (if creating new)
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<string>('ONT');
  const [newItemUnit, setNewItemUnit] = useState<string>('pcs');
  const [newItemMinStock, setNewItemMinStock] = useState<number>(5);

  // Restock Quantities
  const [quantityAdded, setQuantityAdded] = useState<number>(initialItem ? (initialItem.quantity <= initialItem.minStock ? 25 : 10) : 20);

  // Pricing
  const [unitCost, setUnitCost] = useState<number>(
    initialItem?.unitCost || initialItem?.price || 2500
  );
  const [sellingPrice, setSellingPrice] = useState<number>(
    initialItem?.sellingPrice || (initialItem?.unitCost ? Math.round(initialItem.unitCost * 1.35) : 3500)
  );

  // Supplier & Vendor
  const [supplier, setSupplier] = useState<string>(initialItem?.supplier || 'Huawei Telecom Vendor');
  const [supplierContact, setSupplierContact] = useState<string>('0300-8765432');
  const [invoiceNumber, setInvoiceNumber] = useState<string>(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Credit' | 'Partial'>('Paid');

  // Date & Notes
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(todayStr);
  const [warranty, setWarranty] = useState<string>('1 Year Official Warranty');
  const [notes, setNotes] = useState<string>('Verified and received at main warehouse.');
  const [autoExpenseCreated, setAutoExpenseCreated] = useState<boolean>(true);

  // Sync selected item details when dropdown changes
  useEffect(() => {
    if (!isNewItem && selectedItemId) {
      const found = inventoryList.find((i) => i.id === selectedItemId);
      if (found) {
        if (found.unitCost) setUnitCost(found.unitCost);
        if (found.sellingPrice) setSellingPrice(found.sellingPrice);
        if (found.supplier) setSupplier(found.supplier);
      }
    }
  }, [selectedItemId, isNewItem, inventoryList]);

  // Derived current item
  const currentItem = !isNewItem ? inventoryList.find((i) => i.id === selectedItemId) : null;
  const currentQty = currentItem ? currentItem.quantity : 0;
  const projectedQty = currentQty + Number(quantityAdded || 0);
  const totalCost = Number(quantityAdded || 0) * Number(unitCost || 0);
  const profitMarginPerUnit = Number(sellingPrice || 0) - Number(unitCost || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNewItem && !newItemName.trim()) {
      showToast('error', 'Missing Name', 'Please enter new equipment name.');
      return;
    }
    if (!isNewItem && !selectedItemId) {
      showToast('error', 'Select Equipment', 'Please select an item from warehouse inventory.');
      return;
    }
    if (quantityAdded <= 0) {
      showToast('error', 'Invalid Quantity', 'Please enter a quantity greater than zero.');
      return;
    }

    const targetItemId = isNewItem ? `inv-${Date.now()}` : selectedItemId;
    const targetItemName = isNewItem ? newItemName.trim() : (currentItem?.name || 'Equipment');
    const targetCategory = isNewItem ? newItemCategory : (currentItem?.category || currentItem?.categoryName || 'Hardware');

    const restockRecord: RestockRecord = {
      id: `restock-${Date.now()}`,
      itemId: targetItemId,
      itemName: targetItemName,
      category: targetCategory,
      quantityAdded: Number(quantityAdded),
      previousQuantity: currentQty,
      newQuantity: projectedQty,
      unitCost: Number(unitCost),
      totalCost,
      sellingPrice: Number(sellingPrice),
      supplier: supplier.trim(),
      supplierContact: supplierContact.trim(),
      invoiceNumber: invoiceNumber.trim(),
      date,
      paymentMethod,
      paymentStatus,
      recordedBy: user?.email || 'admin@trigonlinks.pk',
      notes: `${notes} (Warranty: ${warranty})`,
      autoExpenseCreated,
      createdAt: new Date().toISOString(),
    };

    StorageService.recordRestock(restockRecord, user?.email);
    showToast(
      'success',
      'Restock Recorded Successfully',
      `Added +${quantityAdded} units to ${targetItemName}. Total stock is now ${projectedQty}.`
    );

    onSuccess(restockRecord);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Restock & Warehouse Purchase Center • Live Stock Inflow`}
      description="Record equipment receiving, purchase prices, supplier invoices, and update live inventory"
      size="xl"
    >
        {/* Form Scroll Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 py-4 space-y-5 text-xs">
          {/* Step 1: Mode Selection (Existing vs New Equipment) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                1. Select Equipment to Restock
              </span>

              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsNewItem(false)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    !isNewItem
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Existing Warehouse Item
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewItem(true)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    isNewItem
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  + Brand New Equipment
                </button>
              </div>
            </div>

            {!isNewItem ? (
              <div className="space-y-3">
                <label htmlFor="choose-hardware-equipment" className="block text-slate-300 font-bold">Choose Hardware / Equipment *</label>
                <select
                   id="choose-hardware-equipment"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-cyan-400 text-xs"
                >
                  <option value="">-- Choose Equipment ({inventoryList.length} items available) --</option>
                  {inventoryList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} &bull; Current Stock: {item.quantity} {item.unit || 'pcs'} &bull; ({item.category || item.categoryName || 'General'})
                    </option>
                  ))}
                </select>

                {currentItem && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Stock</span>
                      <p className={`text-base font-black font-mono mt-0.5 ${currentItem.quantity <= currentItem.minStock ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {currentItem.quantity} {currentItem.unit || 'pcs'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Min Safety Limit</span>
                      <p className="text-base font-black font-mono text-slate-300 mt-0.5">
                        {currentItem.minStock} {currentItem.unit || 'pcs'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Category</span>
                      <p className="text-xs font-bold text-cyan-400 mt-1 truncate">
                        {currentItem.category || currentItem.categoryName || 'Hardware'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Unit Cost</span>
                      <p className="text-base font-black font-mono text-blue-400 mt-0.5">
                        Rs. {(currentItem.unitCost || currentItem.price || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="sm:col-span-2">
                  <label htmlFor="equipment-name-model" className="block text-slate-300 font-bold mb-1">Equipment Name &amp; Model *</label>
                  <input
                     id="equipment-name-model"
                    type="text"
                    required
                    placeholder="e.g. Huawei HG8145V5 Dual Band ONT"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-slate-300 font-bold mb-1">Category *</label>
                  <select
                     id="category"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="ONT">ONT / GPON Terminal</option>
                    <option value="Router">Wi-Fi Router / AP</option>
                    <option value="Cable">Optical Drop Cable</option>
                    <option value="Connector">Fast Connector / Patch Cord</option>
                    <option value="Splitter">PLC Splitter / Box</option>
                    <option value="Tool">Splicer / Power Meter</option>
                    <option value="Hardware">General Network Hardware</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="unit-of-measure" className="block text-slate-300 font-bold mb-1">Unit of Measure</label>
                  <select
                     id="unit-of-measure"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="meters">Meters (m)</option>
                    <option value="rolls">Rolls</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Quantities & Stock Computation */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Plus className="w-4 h-4 text-emerald-400" />
              2. Stock Receiving Quantity
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label htmlFor="units-received" className="block text-slate-300 font-bold mb-1">
                  Units Received / Added *
                </label>
                <div className="relative">
                  <input
                    id="units-received"
                    type="number"
                    min={1}
                    required
                    value={quantityAdded}
                    onChange={(e) => setQuantityAdded(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-emerald-500/80 rounded-xl text-emerald-400 font-mono text-base font-black focus:outline-none focus:border-emerald-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                    {isNewItem ? newItemUnit : (currentItem?.unit || 'pcs')}
                  </span>
                </div>
              </div>

              {/* Quick Increment Buttons */}
              <div className="flex items-center gap-1.5 pt-5">
                {[10, 25, 50, 100].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setQuantityAdded(step)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono font-bold text-xs transition-colors"
                  >
                    +{step}
                  </button>
                ))}
              </div>

              {/* Live Stock Projection Box */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase font-semibold block">Total Stock After Restock</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {projectedQty} <span className="text-xs font-normal text-emerald-300">{isNewItem ? newItemUnit : (currentItem?.unit || 'pcs')}</span>
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <span>Prior: {currentQty}</span>
                  <span className="block text-emerald-400 font-bold">+{quantityAdded} added</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Prices & Financial Calculations */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <DollarSign className="w-4 h-4 text-blue-400" />
              3. Pricing, Costs &amp; Retail Margin
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="unit-purchase-cost" className="block text-slate-300 font-bold mb-1">
                  Unit Purchase Cost (Rs.) *
                </label>
                <div className="relative">
                  <input
                    id="unit-purchase-cost"
                    type="number"
                    min={0}
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-cyan-400 pl-9"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rs.</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Buying price from supplier</span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Customer / Retail Selling Price (Rs.)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-cyan-400 pl-9"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rs.</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Subscriber replacement/installation price</span>
              </div>

              {/* Total Purchase Amount Badge */}
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-blue-300 uppercase font-semibold block">Total Purchase Cost</span>
                  <span className="text-xl font-black text-blue-400 font-mono">
                    Rs. {totalCost.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Gross Margin:</span>
                  <span className="text-emerald-400 font-bold">
                    +Rs. {profitMarginPerUnit.toLocaleString()} / unit
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Supplier, Invoice & Payment Details */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Building2 className="w-4 h-4 text-purple-400" />
              4. Supplier &amp; Invoice Billing Details
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="supplier-vendor-name" className="block text-slate-300 font-bold mb-1">Supplier / Vendor Name *</label>
                <input
                   id="supplier-vendor-name"
                  type="text"
                  required
                  placeholder="e.g. Huawei Telecom Vendor"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="supplier-mobile-contact" className="block text-slate-300 font-bold mb-1">Supplier Mobile / Contact</label>
                <input
                   id="supplier-mobile-contact"
                  type="text"
                  placeholder="0300-8765432"
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label htmlFor="purchase-invoice-po" className="block text-slate-300 font-bold mb-1">Purchase Invoice / PO #</label>
                <input
                   id="purchase-invoice-po"
                  type="text"
                  placeholder="e.g. PO-2026-904"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label htmlFor="payment-method" className="block text-slate-300 font-bold mb-1">Payment Method</label>
                <select
                   id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Bank Transfer">Bank Transfer (Meezan/HBL)</option>
                  <option value="Cash">Cash on Delivery (COD)</option>
                  <option value="Vendor Credit">Vendor Credit (Pay Later)</option>
                  <option value="JazzCash">JazzCash / EasyPaisa</option>
                  <option value="Cheque">Bank Cheque</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 5: Date, Warranty & Notes */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Calendar className="w-4 h-4 text-amber-400" />
              5. Date, Warranty &amp; Auto-Expense Linking
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="receiving-purchase-date" className="block text-slate-300 font-bold mb-1">Receiving / Purchase Date *</label>
                <input
                   id="receiving-purchase-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label htmlFor="warranty-period" className="block text-slate-300 font-bold mb-1">Warranty Period</label>
                <input
                   id="warranty-period"
                  type="text"
                  placeholder="e.g. 1 Year Official Warranty"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="notes-remarks" className="block text-slate-300 font-bold mb-1">Notes / Remarks</label>
                <input
                   id="notes-remarks"
                  type="text"
                  placeholder="Batch #, Box serial numbers, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Auto Expense Post Checkbox */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-200 font-bold">
                <input
                  type="checkbox"
                  checked={autoExpenseCreated}
                  onChange={(e) => setAutoExpenseCreated(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
                <span>
                  Auto-record as Operational Expense under &ldquo;Hardware Purchases&rdquo; (Rs. {totalCost.toLocaleString()})
                </span>
              </label>
              <span className="text-[10px] text-slate-400">
                Syncs with Financials &amp; Expense Ledger
              </span>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Recording stock receiving by: <strong className="text-slate-200">{user?.name || user?.email}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm &amp; Receive Stock (+{quantityAdded} Units)
            </button>
          </div>
        </div>
    </Modal>
  );
};
