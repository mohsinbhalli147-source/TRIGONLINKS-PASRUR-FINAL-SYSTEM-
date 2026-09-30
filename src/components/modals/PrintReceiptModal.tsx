import React from 'react';
import { Invoice, Customer } from '../../types';
import { StorageService } from '../../services/storage';
import { Printer, CheckCircle, Wifi, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';

interface PrintReceiptModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({ invoice, onClose }) => {
  const customer = StorageService.getCustomers().find((c) => c.id === invoice.customerId);
  const settings = StorageService.getSettings();

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Tax Invoice &amp; Payment Receipt"
      size="lg"
    >
        <div className="flex items-center justify-end gap-2 pb-4 border-b border-slate-800 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
        </div>

        {/* Printable Area */}
        <div id="printable-receipt-area" className="bg-white text-slate-900 p-8 rounded-2xl mt-4 font-sans text-xs">
          {/* Company Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                  TL
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {settings.companyName.toUpperCase()}
                </h1>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">{settings.address}</p>
              <p className="text-[11px] text-slate-600">Phone: {settings.phone} &bull; Email: {settings.email}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">NTN/License: {settings.licenseNumber}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                invoice.status === 'Paid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : invoice.status === 'Partial'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {invoice.status} INVOICE
              </span>
              <p className="text-base font-black font-mono mt-2 text-slate-900">#{invoice.invoiceNumber}</p>
              <p className="text-[11px] text-slate-600">Billing Period: {invoice.month}</p>
              <p className="text-[11px] text-slate-600">Due Date: {invoice.dueDate}</p>
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subscriber Details</span>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">{invoice.customerName}</p>
              <p className="text-slate-600">Mobile: {invoice.customerMobile}</p>
              <p className="text-slate-600">Username: {customer?.username || 'N/A'}</p>
              <p className="text-slate-600">CNIC: {customer?.cnic || 'N/A'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connection Info</span>
              <p className="text-slate-700 font-medium mt-0.5">{customer?.packageName || 'Standard Package'}</p>
              <p className="text-slate-600">Coverage Zone: {customer?.areaName || 'General Area'}</p>
              <p className="text-slate-600 font-mono text-[11px]">IP Address: {customer?.ipAddress || '192.168.10.x'}</p>
              <p className="text-slate-600">ONT/Device: {customer?.device || 'GPON Terminal'}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-slate-800 text-[11px] font-extrabold uppercase text-slate-700">
                <th className="py-2.5">Item Description</th>
                <th className="py-2.5 text-center">Type</th>
                <th className="py-2.5 text-right">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5">
                  <span className="font-bold text-slate-900">{customer?.packageName || 'Monthly Internet Bandwidth'}</span>
                  <p className="text-[11px] text-slate-500">High speed fiber broadband CIR connection</p>
                </td>
                <td className="py-2.5 text-center text-slate-600">Recurring</td>
                <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                  Rs. {(invoice.breakdown.packageFee || invoice.amount).toLocaleString()}
                </td>
              </tr>
              {invoice.breakdown.ipCharges > 0 && (
                <tr>
                  <td className="py-2.5 font-bold text-slate-900">Static Public IPv4 Allocation</td>
                  <td className="py-2.5 text-center text-slate-600">Monthly Addon</td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                    Rs. {invoice.breakdown.ipCharges.toLocaleString()}
                  </td>
                </tr>
              )}
              {invoice.breakdown.iptvCharges > 0 && (
                <tr>
                  <td className="py-2.5 font-bold text-slate-900">HD IPTV Multi-Screen Package</td>
                  <td className="py-2.5 text-center text-slate-600">Monthly Addon</td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                    Rs. {invoice.breakdown.iptvCharges.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Financial Totals */}
          <div className="flex justify-between items-start pt-3 border-t-2 border-slate-800">
            <div className="max-w-xs text-[11px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">Payment Modes Accepted:</p>
              <p>&bull; Cash collection via authorized Trigon Links lineman</p>
              <p>&bull; JazzCash / EasyPaisa / Bank Alfalah / Meezan Bank</p>
              <p>&bull; Customer Advance Digital Wallet</p>
            </div>
            <div className="w-64 space-y-1.5 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Amount:</span>
                <span className="font-mono">Rs. {invoice.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax / GST Included:</span>
                <span className="font-mono">Included (PRA)</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
                <span>Total Paid:</span>
                <span className="font-mono">Rs. {invoice.paidAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t-2 border-slate-900 pt-1.5">
                <span>Balance Due:</span>
                <span className="font-mono text-rose-600">Rs. {invoice.remainingAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Verification & Signature */}
          <div className="mt-8 pt-6 border-t border-dashed border-slate-300 flex justify-between items-end">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 border border-slate-300 rounded-lg flex items-center justify-center text-[10px] font-mono text-slate-400 bg-slate-50 text-center">
                DIGITAL<br />STAMP
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-800">Trigon Links Billing NOC</p>
                <p className="text-[10px] text-slate-500">Auto-generated electronic receipt.</p>
              </div>
            </div>
            <div className="text-center w-48 border-t border-slate-400 pt-1">
              <p className="text-[10px] text-slate-600 uppercase font-semibold">Authorized Signatory</p>
            </div>
          </div>
        </div>
    </Modal>
  );
};
