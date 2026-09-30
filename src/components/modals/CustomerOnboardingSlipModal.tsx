import React, { useState, useEffect } from 'react';
import { Customer, ConnectionRequest } from '../../types';
import { StorageService } from '../../services/storage';
import { useToast } from '../../context/ToastContext';
import {
  Printer,
  MessageCircle,
  Copy,
  Check,
  Wifi,
  ShieldCheck,
  DollarSign,
  Package,
  Layers,
  MapPin,
  ExternalLink,
  Phone,
  FileText,
  User,
  Zap,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface CustomerOnboardingSlipModalProps {
  customer?: Customer | null;
  connection?: ConnectionRequest | null;
  isOpen: boolean;
  onClose: () => void;
  autoPrint?: boolean;
}

export const CustomerOnboardingSlipModal: React.FC<CustomerOnboardingSlipModalProps> = ({
  customer,
  connection,
  isOpen,
  onClose,
  autoPrint = false,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'slip' | 'message'>('slip');
  const [copied, setCopied] = useState(false);

  // Normalize data whether from Customer or ConnectionRequest
  const name = customer?.name || connection?.applicantName || connection?.customerName || 'Subscriber';
  const fatherName = customer?.fatherName || connection?.fatherName || '—';
  const username = customer?.username || connection?.username || customer?.pppoeUsername || connection?.pppoeUsername || 'user101';
  const password = customer?.pppoePassword || connection?.password || connection?.pppoePassword || 'pass@123';
  const mobile = customer?.mobile || connection?.mobile || '';
  const altMobile = customer?.alternateMobile || connection?.alternateMobile || '';
  const cnic = customer?.cnic || connection?.cnic || '—';
  const email = customer?.email || connection?.email || '';
  const address = customer?.address || connection?.address || '';
  const areaName = customer?.areaName || connection?.areaName || 'General';
  const packageName = customer?.packageName || connection?.packageName || 'Broadband Plan';
  const packageSpeed = customer?.packageSpeed || connection?.packageSpeed || '20 Mbps';
  
  // Fees
  const monthlyFee = customer?.monthlyFee ?? connection?.monthlyFee ?? 2500;
  const connectionFee = customer?.connectionFee ?? connection?.connectionFee ?? 2500;
  
  // Discounts
  const discountSetup = customer?.discountSetup ?? connection?.discountSetup ?? 0;
  const discountMonthly = customer?.discountMonthly ?? connection?.discountMonthly ?? 0;
  const legacyDiscount = customer?.discount ?? connection?.discount ?? 0;
  const effectiveSetupDiscount = discountSetup > 0 ? discountSetup : (customer?.discountType === 'setup' ? legacyDiscount : 0);
  const effectiveMonthlyDiscount = discountMonthly > 0 ? discountMonthly : (customer?.discountType === 'monthly' ? legacyDiscount : 0);
  const discountReason = customer?.discountReason || connection?.discountReason || 'Promotional Tariff';

  // Net amounts
  const netMonthly = Math.max(0, monthlyFee - effectiveMonthlyDiscount);
  
  // Inventory hardware
  const inventoryItems = customer?.assignedInventory || connection?.assignedInventory || [];
  const hardwareTotal = inventoryItems.reduce((acc, item) => acc + (Number(item.totalPrice) || (Number(item.unitPrice) * Number(item.quantity)) || 0), 0);
  const totalSetupGross = connectionFee + hardwareTotal;
  const netSetupDue = Math.max(0, totalSetupGross - effectiveSetupDiscount);

  // Technical
  const connectionType = customer?.connectionType || connection?.connectionType || 'Fiber';
  const opticalPower = customer?.opticalPowerDbm ?? connection?.opticalPowerDbm ?? -19.4;
  const ipAddress = customer?.ipAddress || connection?.ipAddress || '192.168.10.15';
  const installDate = customer?.installDate || connection?.installDate || new Date().toISOString().split('T')[0];

  // Portal URL
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://trigonlinks.pk';

  // Auto-Print trigger if requested
  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Generate WhatsApp / SMS text
  const messageText = `🎉 *Welcome to Trigon Links FTTH Broadband!*

Dear *${name}*,
Your high-speed fiber optic connection has been successfully approved and activated!

📋 *Your Account & Service Details:*
• Name: ${name}
• PPPoE / Account Username: *${username}*
• Portal / WiFi Password: *${password}*
• Registered CNIC: ${cnic}
• Phone: ${mobile}
• Area / Zone: ${areaName}
• Plan: ${packageName} (${packageSpeed})

💰 *Billing & Payment Summary:*
• Regular Monthly Tariff: Rs. ${monthlyFee.toLocaleString()}
${effectiveMonthlyDiscount > 0 ? `• Monthly Bill Discount: -Rs. ${effectiveMonthlyDiscount.toLocaleString()} (${discountReason})\n` : ''}• *Net Monthly Payable: Rs. ${netMonthly.toLocaleString()}*
• First-Time Setup & Equipment: Rs. ${totalSetupGross.toLocaleString()}
${effectiveSetupDiscount > 0 ? `• Setup Fee Discount: -Rs. ${effectiveSetupDiscount.toLocaleString()}\n` : ''}• *Net Initial Setup Paid: Rs. ${netSetupDue.toLocaleString()}*

🌐 *Customer Self-Care Portal:*
Ap apne Username (*${username}*) ya CNIC (*${cnic}*) sy iss link / app mein login kar ky mukamal apna profile, active package, internet usage, aur monthly bills/invoices dekh sakty hain:
👉 *${portalUrl}*

🛠️ *24/7 Technical NOC Helpline:*
Phone: +92 300 1234567 / (052) 6543210
Network Lineman: Assigned NOC Team

_Thank you for choosing Trigon Links Fiber Network!_`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    showToast('success', 'Message Copied', 'Welcome message copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const cleanPhone = mobile.replace(/[^0-9]/g, '');
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('03')) {
      formattedPhone = '92' + formattedPhone.substring(1);
    }
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    showToast('info', 'WhatsApp Opened', `Prepared welcome message for ${mobile}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subscriber Onboarding Voucher &amp; Dispatch"
      description="Official receipt, thermal voucher slip, and WhatsApp dispatch"
      size="xl"
    >
        {/* View Mode Tabs (Hidden in print) */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs w-fit mb-4 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('slip')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'slip' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Printable Slip
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('message')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'message' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp / SMS Msg
          </button>
        </div>

        {/* Tab 1: Printable Slip View */}
        {activeTab === 'slip' ? (
          <div className="p-6 md:p-8 space-y-6 print:p-4 text-slate-900 bg-white min-h-[500px]">
            {/* Slip Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-950 tracking-tight">TRIGON LINKS</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                    FTTH BROADBAND
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">High-Speed Symmetric Fiber Optics &bull; Pasrur NOC</p>
                <p className="text-[11px] text-slate-500">Helpline: +92 300 1234567 | (052) 6543210</p>
              </div>

              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase border border-emerald-300">
                  Connection Activated
                </span>
                <p className="text-[11px] font-mono text-slate-600 mt-1">Date: {installDate}</p>
                <p className="text-[11px] font-mono font-bold text-slate-900">Voucher #: TL-{username.toUpperCase()}</p>
              </div>
            </div>

            {/* Subscriber Information Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Subscriber Name</span>
                <p className="font-black text-slate-900 text-sm mt-0.5">{name}</p>
                {fatherName !== '—' && <p className="text-[11px] text-slate-600">S/O {fatherName}</p>}
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Mobile &amp; CNIC</span>
                <p className="font-bold text-slate-900 font-mono text-xs mt-0.5">{mobile}</p>
                <p className="text-[11px] text-slate-600 font-mono">CNIC: {cnic}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Zone &amp; Address</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">{areaName}</p>
                <p className="text-[11px] text-slate-600 line-clamp-1">{address}</p>
              </div>
            </div>

            {/* Package & Service Configuration */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Broadband Plan</span>
                <p className="font-black text-slate-900 text-sm mt-0.5">{packageName}</p>
                <span className="text-[11px] font-bold text-cyan-700 font-mono">{packageSpeed} CIR</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">PPPoE Username</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">{username}</p>
                <span className="text-[10px] text-slate-500">Pass: {password}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Medium &amp; Optical Rx</span>
                <p className="font-bold text-slate-900 mt-0.5">{connectionType} FTTH</p>
                <span className="text-[11px] font-mono text-emerald-700 font-bold">{opticalPower} dBm</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Assigned IP</span>
                <p className="font-mono font-bold text-slate-900 mt-0.5">{ipAddress}</p>
                <span className="text-[10px] text-slate-500">Gateway: 192.168.10.1</span>
              </div>
            </div>

            {/* Allocated Hardware Inventory Table */}
            {inventoryItems.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Allocated CPE Hardware &amp; Installation Materials
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-1.5">Hardware Item</th>
                        <th className="px-3 py-1.5 text-center">Qty</th>
                        <th className="px-3 py-1.5 text-right">Unit Price</th>
                        <th className="px-3 py-1.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {inventoryItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-1.5 text-slate-900 font-sans font-medium">{item.itemName}</td>
                          <td className="px-3 py-1.5 text-center">{item.quantity}</td>
                          <td className="px-3 py-1.5 text-right">Rs. {(item.unitPrice || 0).toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-slate-900">
                            Rs. {(item.totalPrice || item.unitPrice * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Ledger & Breakdown Table */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Financial Breakdown &amp; Tariffs
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Monthly Recurring Box */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Base Monthly Package Fee:</span>
                    <span className="font-mono font-bold">Rs. {monthlyFee.toLocaleString()}</span>
                  </div>
                  {effectiveMonthlyDiscount > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700 font-medium">
                      <span>Monthly Bill Discount ({discountReason}):</span>
                      <span className="font-mono font-bold">-Rs. {effectiveMonthlyDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-900 font-black text-sm">
                    <span>Net Monthly Tariff:</span>
                    <span className="font-mono text-cyan-800">Rs. {netMonthly.toLocaleString()}/mo</span>
                  </div>
                </div>

                {/* First-Time Setup & Hardware Box */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Installation / Connection Fee:</span>
                    <span className="font-mono">Rs. {connectionFee.toLocaleString()}</span>
                  </div>
                  {hardwareTotal > 0 && (
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>CPE Hardware &amp; Cable Materials:</span>
                      <span className="font-mono">Rs. {hardwareTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {effectiveSetupDiscount > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700 font-medium">
                      <span>Setup Discount ({discountReason}):</span>
                      <span className="font-mono font-bold">-Rs. {effectiveSetupDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-900 font-black text-sm">
                    <span>Net Initial Setup Paid:</span>
                    <span className="font-mono text-emerald-800">Rs. {netSetupDue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CUSTOMER PORTAL ACCESS NOTICE (EXPLICIT USER REQUIREMENT) */}
            <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-400 text-blue-950 flex items-start gap-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-xs uppercase tracking-wider text-blue-900">
                  Customer Self-Care Portal &bull; Online Access
                </p>
                <p className="text-xs font-semibold text-blue-950 mt-1 leading-relaxed">
                  Ap apne <strong>Username ({username})</strong> ya <strong>CNIC ({cnic})</strong> sy iss app / link mein login kar ky mukamal apna profile, active package, internet usage, aur invoices dekh sakty hain:
                </p>
                <p className="text-xs font-mono font-black text-blue-800 mt-1">
                  👉 {portalUrl}
                </p>
              </div>
            </div>

            {/* Signature Row */}
            <div className="pt-6 flex justify-between items-end text-[10px] text-slate-500 font-sans">
              <div>
                <div className="w-36 border-b border-slate-400 mb-1" />
                <p>NOC Engineer / Field Lineman</p>
              </div>
              <div className="text-right">
                <div className="w-36 border-b border-slate-400 mb-1 ml-auto" />
                <p>Subscriber Signature</p>
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: WhatsApp & SMS Auto Message View */
          <div className="p-6 md:p-8 space-y-5 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Auto-Generated Welcome Message
                </span>
                <span className="text-[10px] text-slate-500">Ready to dispatch via WhatsApp or SMS</span>
              </div>
              
              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {messageText}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                 type="button"
                onClick={handleOpenWhatsApp}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Send via WhatsApp ({mobile})
              </button>

              <button
                 type="button"
                onClick={handleCopyMessage}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                {copied ? 'Copied to Clipboard!' : 'Copy SMS / Text'}
              </button>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer (Hidden in Print) */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-950 print:hidden">
          <button
             type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
               type="button"
              onClick={handleOpenWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Send WhatsApp
            </button>
            <button
               type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Auto Print Slip
            </button>
          </div>
        </div>
    </Modal>
  );
};
