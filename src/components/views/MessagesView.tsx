import React, { useState } from 'react';
import { Customer } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  MessageSquare,
  Send,
  Search,
  CheckCheck,
  Plus,
  Phone,
  Sparkles,
  ExternalLink,
  MessageCircle,
  FileText,
  CreditCard,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface OutboundMessage {
  id: string;
  recipientName: string;
  recipientPhone: string;
  channel: 'SMS' | 'WhatsApp';
  content: string;
  sentAt: string;
  status: 'Delivered' | 'Sent';
}

const INITIAL_MESSAGES: OutboundMessage[] = [
  {
    id: 'msg-1',
    recipientName: 'Ali Khan',
    recipientPhone: '0300-1122334',
    channel: 'WhatsApp',
    content: 'Dear Ali Khan, your Trigon Links bill of Rs. 2,000 for Sep 2026 is due by 10-09-2026. Pay via JazzCash or Lineman.',
    sentAt: '2026-09-10 11:30',
    status: 'Delivered',
  },
  {
    id: 'msg-2',
    recipientName: 'Usman Ghani',
    recipientPhone: '0321-4455667',
    channel: 'SMS',
    content: 'Payment Received: Rs. 3,500 credited to account #cust-002. Thank you for choosing Trigon Links Fiber.',
    sentAt: '2026-09-12 14:15',
    status: 'Delivered',
  },
];

export const MessagesView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<OutboundMessage[]>(INITIAL_MESSAGES);
  const [customers] = useState<Customer[]>(StorageService.getCustomers());
  const [invoices] = useState(StorageService.getInvoices());
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customers[0] || null);
  const [channel, setChannel] = useState<'SMS' | 'WhatsApp'>('WhatsApp');
  const [content, setContent] = useState('');

  const openCompose = (cust?: Customer, templateText?: string) => {
    const target = cust || customers[0] || null;
    setSelectedCustomer(target);
    setContent(templateText || (target ? `Dear ${target.name}, thank you for choosing Trigon Links Fiber.` : ''));
    setIsComposeOpen(true);
  };

  const handleApplyTemplate = (type: 'bill' | 'receipt' | 'maint' | 'welcome' | 'suspended') => {
    if (!selectedCustomer) return;
    const name = selectedCustomer.name;
    const fee = selectedCustomer.totalMonthly || selectedCustomer.monthlyFee || 2000;

    if (type === 'bill') {
      setContent(
        `Dear ${name}, your monthly internet invoice of Rs. ${fee.toLocaleString()} for Trigon Links Fiber is now due. Please settle your bill to avoid line disconnection. Thank you!`
      );
    } else if (type === 'receipt') {
      setContent(
        `Dear ${name}, your payment of Rs. ${fee.toLocaleString()} has been received successfully. Your high-speed fiber connection is active. Thank you! - Trigon Links Pasrur`
      );
    } else if (type === 'maint') {
      setContent(
        `Dear ${name}, scheduled fiber maintenance is planned in your area (${selectedCustomer.areaName || 'Pasrur'}) tonight between 02:00 AM and 04:00 AM. Internet speeds may experience brief disruption. We apologize for any inconvenience.`
      );
    } else if (type === 'welcome') {
      setContent(
        `Welcome ${name}! Thank you for choosing Trigon Links Fiber. Your Username: ${selectedCustomer.username} | Plan: ${selectedCustomer.packageName || 'Active Plan'}. Helpline: 0300-1234567`
      );
    } else if (type === 'suspended') {
      setContent(
        `Dear ${name}, your internet connection has been temporarily suspended due to outstanding dues. Please clear your bill to restore service immediately. Thank you! - Trigon Links`
      );
    }
  };

  const cleanPhoneForWhatsApp = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('03')) {
      clean = '92' + clean.substring(1);
    } else if (clean.startsWith('3')) {
      clean = '92' + clean;
    }
    return clean;
  };

  const handleDirectWhatsApp = (cust: Customer, text: string) => {
    const phone = cleanPhoneForWhatsApp(cust.mobile);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    const newMsg: OutboundMessage = {
      id: `msg-${Date.now()}`,
      recipientName: cust.name,
      recipientPhone: cust.mobile,
      channel: 'WhatsApp',
      content: text,
      sentAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'Delivered',
    };
    setMessages([newMsg, ...messages]);
    StorageService.logActivity(user?.email || 'admin@trigonlinks.pk', user?.name || 'Staff', 'WhatsApp Dispatched', 'messages', `Direct WhatsApp to ${cust.name}: "${text}"`);
    showToast('success', 'WhatsApp Opened', `Message prefilled for ${cust.name}`);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !content) return;

    if (channel === 'WhatsApp') {
      handleDirectWhatsApp(selectedCustomer, content);
    } else {
      const newMsg: OutboundMessage = {
        id: `msg-${Date.now()}`,
        recipientName: selectedCustomer.name,
        recipientPhone: selectedCustomer.mobile,
        channel: 'SMS',
        content,
        sentAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'Delivered',
      };
      setMessages([newMsg, ...messages]);
      StorageService.logActivity(user?.email || 'admin@trigonlinks.pk', user?.name || 'Staff', 'SMS Dispatched', 'messages', `SMS sent to ${selectedCustomer.name}: "${content}"`);
      showToast('success', 'SMS Dispatched', `SMS sent to ${selectedCustomer.name}`);
    }

    setIsComposeOpen(false);
  };

  // Filtered customer search for compose/quick actions (Universal search by name, username, phone, cnic, ip, area)
  const matchingCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      (c.cnic && c.cnic.includes(q)) ||
      (c.ipAddress && c.ipAddress.includes(q)) ||
      (c.areaName && c.areaName.toLowerCase().includes(q)) ||
      (c.packageName && c.packageName.toLowerCase().includes(q))
    );
  });

  const filteredHistory = messages.filter(
    (m) =>
      m.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      m.recipientPhone.includes(search) ||
      m.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-cyan-400" />
            Automated WhatsApp &amp; SMS Dispatch Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant 1-click WhatsApp alerts, automated billing reminders, payment receipts &amp; maintenance broadcasts
          </p>
        </div>

        <button
           type="button"
          onClick={() => openCompose()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40"
        >
          <Send className="w-4 h-4" />
          Compose New Message
        </button>
      </div>

      {/* ⚡ SMART AUTO-GENERATED TEMPLATES & QUICK DISPATCH FOR SUBSCRIBERS */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Instant Customer Message Gateway
            </h3>
            <p className="text-xs text-slate-400">Search customer by Name, Phone, Username, IP, CNIC or Area to send 1-click WhatsApp/SMS</p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name, Mobile, Username, IP, CNIC..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400 font-medium"
            />
          </div>
        </div>

        {/* Customer Quick Cards with Direct WhatsApp Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {matchingCustomers.slice(0, 6).map((cust) => {
            const dueInv = invoices.find((i) => i.customerId === cust.id && i.status !== 'Paid');
            const billText = `Dear ${cust.name}, your Trigon Links bill of Rs. ${(cust.totalMonthly || 2000).toLocaleString()} is now due. Please settle payment to keep connection active. Thank you!`;
            const receiptText = `Dear ${cust.name}, your payment of Rs. ${(cust.totalMonthly || 2000).toLocaleString()} has been received. Thank you! - Trigon Links Pasrur`;

            return (
              <div
                key={cust.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-600/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-xs">{cust.name}</h4>
                      <span className="text-[10px] font-mono text-cyan-400 block">{cust.username} &bull; {cust.mobile}</span>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        cust.status === 'Active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {cust.status}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-1">
                    📍 {cust.areaName || 'Pasrur'} &bull; ⚡ {cust.packageName || 'FTTH'} &bull; Rs. {(cust.totalMonthly || 2000).toLocaleString()}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-[11px]">
                  <button
                     type="button"
                    onClick={() => handleDirectWhatsApp(cust, billText)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold flex items-center justify-center gap-1 transition-colors text-[10px]"
                  >
                    <MessageCircle className="w-3 h-3" /> WhatsApp Bill
                  </button>

                  <button
                     type="button"
                    onClick={() => handleDirectWhatsApp(cust, receiptText)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold flex items-center justify-center gap-1 transition-colors text-[10px] border border-slate-700"
                  >
                    <CreditCard className="w-3 h-3" /> Receipt Msg
                  </button>

                  <button
                     type="button"
                    onClick={() => openCompose(cust)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Custom message"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outbound Dispatch History */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between text-xs">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dispatched message log..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <span className="text-slate-400 font-semibold">{filteredHistory.length} Dispatched Messages</span>
        </div>

        <div className="space-y-3">
          {filteredHistory.map((msg) => (
            <div
              key={msg.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    msg.channel === 'WhatsApp'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}
                >
                  {msg.channel === 'WhatsApp' ? <MessageCircle className="w-5 h-5 text-emerald-400" /> : <Phone className="w-5 h-5 text-blue-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{msg.recipientName}</h4>
                    <span className="text-xs text-slate-400 font-mono">({msg.recipientPhone})</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">{msg.content}</p>
                </div>
              </div>

              <div className="text-right shrink-0 text-xs">
                <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end">
                  <CheckCheck className="w-3.5 h-3.5" /> {msg.status}
                </span>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{msg.sentAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposeOpen && (
        <Modal
          isOpen
          onClose={() => setIsComposeOpen(false)}
          title="Send Subscriber Notice"
          size="lg"
        >
          <form onSubmit={handleSend} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Select Recipient (Universal Search)</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search subscriber by Name, Phone, CNIC..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  />
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const cust = customers.find((c) => c.id === e.target.value);
                      setSelectedCustomer(cust || null);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  >
                    {matchingCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} &bull; {c.mobile} ({c.areaName} - {c.packageName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Dispatch Gateway</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('WhatsApp')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      channel === 'WhatsApp'
                        ? 'bg-emerald-600 text-slate-950 border-emerald-500 font-black shadow-lg shadow-emerald-950/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp Web / App
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('SMS')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      channel === 'SMS'
                        ? 'bg-blue-600 text-white border-blue-500 font-black shadow-lg shadow-blue-950/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <Phone className="w-4 h-4" /> Bulk SMS Gateway
                  </button>
                </div>
              </div>

              {/* Quick Template Fillers */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">Apply Instant Urdu/English Templates:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('bill')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-300 text-[11px] border border-slate-700"
                  >
                    📄 Bill Due Notice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('receipt')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-emerald-300 text-[11px] border border-slate-700"
                  >
                    💳 Payment Received
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('welcome')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 text-[11px] border border-slate-700"
                  >
                    👋 Onboarding Welcome
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('suspended')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-rose-300 text-[11px] border border-slate-700"
                  >
                    🚫 Suspension Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('maint')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-300 text-[11px] border border-slate-700"
                  >
                    ⚠️ Maintenance Alert
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="message-content" className="block text-slate-300 font-bold mb-1">Message Content *</label>
                <textarea
                   id="message-content"
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {channel === 'WhatsApp' ? 'Send via WhatsApp' : 'Dispatch SMS'}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
};
