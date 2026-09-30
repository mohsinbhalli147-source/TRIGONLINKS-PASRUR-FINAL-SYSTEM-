import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError, fetchPortal, lodgeComplaint, type PortalData } from './api';

/* -------------------------------------------------------------------------- */
/*  Small shared pieces                                                       */
/* -------------------------------------------------------------------------- */

const currency = (amount: number | undefined) =>
  `Rs. ${Number(amount ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const Row: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800/70 last:border-0">
    <span className="text-xs text-slate-400 shrink-0">{label}</span>
    <span className={`text-xs text-white text-right font-semibold ${mono ? 'font-mono' : ''}`}>
      {value}
    </span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
    <h2 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-1">{title}</h2>
    {children}
  </section>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-500 text-center py-8">{children}</p>
);

const statusTone = (status?: string): string => {
  const value = (status ?? '').toLowerCase();
  if (value === 'paid' || value === 'solved' || value === 'active') {
    return 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300';
  }
  if (value === 'pending' || value === 'open' || value === 'unpaid') {
    return 'bg-amber-950/60 border-amber-800/60 text-amber-300';
  }
  return 'bg-slate-800/60 border-slate-700 text-slate-300';
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => (
  <span
    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${statusTone(status)}`}
  >
    {status ?? 'Unknown'}
  </span>
);

/* -------------------------------------------------------------------------- */
/*  Profile tab                                                               */
/* -------------------------------------------------------------------------- */

const ProfileTab: React.FC<{ data: PortalData }> = ({ data }) => {
  const p = data.profile;
  const dues = data.invoices
    .filter((i) => i.status?.toLowerCase() !== 'paid')
    .reduce((sum, i) => sum + (i.remainingAmount || 0), 0);
  const monthly = Math.max(
    0,
    (p.totalMonthly ?? p.monthlyFee ?? 0) - (p.discountMonthly ?? p.discount ?? 0)
  );

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-blue-950/60 to-cyan-950/40 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg shrink-0">
            {p.name?.trim()?.[0]?.toUpperCase() ?? 'S'}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-white truncate">{p.name}</h1>
            <p className="text-xs text-cyan-300 font-mono truncate">{p.username}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Monthly Bill</p>
            <p className="text-sm font-black text-white mt-0.5">{currency(monthly)}</p>
          </div>
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Outstanding</p>
            <p className={`text-sm font-black mt-0.5 ${dues > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {currency(dues)}
            </p>
          </div>
        </div>
      </div>

      <Section title="Connection">
        <Row label="Status" value={<StatusPill status={p.status} />} />
        <Row label="Package" value={p.packageName ?? '-'} />
        <Row label="Speed" value={p.packageSpeed ? `${p.packageSpeed} Mbps` : '-'} />
        <Row label="Area" value={p.areaName ?? '-'} />
        <Row label="Bill Date" value={p.billingDate ? `${p.billingDate}${ordinal(p.billingDate)} of each month` : '-'} />
        <Row label="Installed" value={formatDate(p.installDate)} />
      </Section>

      <Section title="Your account details">
        <Row label="Mobile" value={p.mobile ?? '-'} mono />
        <Row label="Email" value={p.email ?? '-'} />
        <Row label="CNIC" value={maskCnic(p.cnic)} mono />
        <Row label="Address" value={p.address ?? '-'} />
      </Section>

      {p.pppoeUsername || p.pppoePassword ? (
        <Section title="Router login">
          <Row label="PPPoE user" value={p.pppoeUsername ?? '-'} mono />
          <Row label="PPPoE password" value={p.pppoePassword ?? '-'} mono />
          <Row label="IP address" value={p.ipAddress ?? 'Dynamic'} mono />
          <Row label="Gateway" value={p.gateway ?? '-'} mono />
        </Section>
      ) : null}
    </div>
  );
};

const ordinal = (n: number) => {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
};

/** Shows only the identifying prefix, never the full national ID. */
const maskCnic = (cnic?: string) => {
  if (!cnic) return '-';
  const digits = cnic.replace(/\D/g, '');
  if (digits.length !== 13) return cnic;
  return `${digits.slice(0, 5)}*****-${digits.slice(-1)}`;
};

/* -------------------------------------------------------------------------- */
/*  Payments tab                                                              */
/* -------------------------------------------------------------------------- */

const PaymentsTab: React.FC<{ data: PortalData }> = ({ data }) => {
  const [tab, setTab] = useState<'invoices' | 'history'>('invoices');

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Payment records"
        className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl"
      >
        {(
          [
            ['invoices', `Bills (${data.invoices.length})`],
            ['history', `Payments (${data.payments.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-colors ${
              tab === key
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'invoices' ? (
        data.invoices.length === 0 ? (
          <Section title="Bills">
            <Empty>No bills have been issued yet.</Empty>
          </Section>
        ) : (
          <div className="space-y-2">
            {data.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">{invoice.month}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{invoice.invoiceNumber}</p>
                  </div>
                  <StatusPill status={invoice.status} />
                </div>
                <div className="mt-3 space-y-0.5">
                  <Row label="Bill amount" value={currency(invoice.amount)} />
                  <Row label="Paid" value={currency(invoice.paidAmount)} />
                  {invoice.remainingAmount > 0 && (
                    <Row
                      label="Due"
                      value={<span className="text-rose-400">{currency(invoice.remainingAmount)}</span>}
                    />
                  )}
                  <Row label="Due date" value={formatDate(invoice.dueDate)} />
                  {invoice.paidDate && <Row label="Paid on" value={formatDate(invoice.paidDate)} />}
                </div>
              </div>
            ))}
          </div>
        )
      ) : data.payments.length === 0 ? (
        <Section title="Payment history">
          <Empty>No payments recorded yet.</Empty>
        </Section>
      ) : (
        <div className="space-y-2">
          {data.payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-400">{currency(payment.amount)}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{payment.receiptNumber}</p>
                </div>
                <StatusPill status="paid" />
              </div>
              <div className="mt-3 space-y-0.5">
                <Row label="Date" value={formatDate(payment.date)} />
                <Row label="Method" value={payment.method ?? '-'} />
                {(payment.discount ?? 0) > 0 && (
                  <Row label="Discount" value={currency(payment.discount)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Complaints tab                                                            */
/* -------------------------------------------------------------------------- */

const ComplaintsTab: React.FC<{ data: PortalData; onLodged: () => void }> = ({ data, onLodged }) => {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('No internet connection');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 5) {
      setError('Please describe the problem in a sentence or two.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await lodgeComplaint({ subject, message: message.trim(), priority });
      setDone(result.complaint.ticketNumber);
      setMessage('');
      setOpen(false);
      onLodged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your complaint.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-sm shadow-lg shadow-cyan-900/40 active:scale-[0.99] transition-transform"
      >
        Report a problem
      </button>

      {done && (
        <p
          role="status"
          className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-900/60 rounded-2xl px-3 py-2.5"
        >
          Ticket <strong className="font-mono">{done}</strong> has been sent to the NOC team.
        </p>
      )}

      {data.complaints.length === 0 ? (
        <Section title="Your tickets">
          <Empty>You have not reported any problems.</Empty>
        </Section>
      ) : (
        <div className="space-y-2">
          {data.complaints.map((complaint) => (
            <div
              key={complaint.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{complaint.subject}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{complaint.ticketNumber}</p>
                </div>
                <StatusPill status={complaint.status} />
              </div>
              {complaint.description && (
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{complaint.description}</p>
              )}
              <div className="mt-3 space-y-0.5">
                <Row label="Logged" value={formatDate(complaint.createdAt)} />
                <Row label="Priority" value={complaint.priority} />
                {complaint.assignedStaff && (
                  <Row label="Assigned to" value={complaint.assignedStaff} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complaint-dialog-title"
            className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900">
              <h2 id="complaint-dialog-title" className="text-base font-black text-white">
                Report a problem
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-white text-xl leading-none px-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={submit} className="p-4 space-y-4">
              <div>
                <label
                  htmlFor="complaint-subject"
                  className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider"
                >
                  Problem
                </label>
                <select
                  id="complaint-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-400"
                >
                  {[
                    'No internet connection',
                    'Intermittent disconnecting',
                    'Very slow speed',
                    'Red LOS light on router',
                    'Bill or payment query',
                    'Requesting a plan change',
                    'Other',
                  ].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="complaint-priority"
                  className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider"
                >
                  Urgency
                </label>
                <div id="complaint-priority" role="group" className="flex gap-2">
                  {['Low', 'Medium', 'High', 'Urgent'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level)}
                      aria-pressed={priority === level}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors ${
                        priority === level
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-950 text-slate-300 border-slate-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="complaint-message"
                  className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider"
                >
                  Describe it
                </label>
                <textarea
                  id="complaint-message"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setError(null);
                  }}
                  placeholder="When did it start? What have you already tried?"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-y"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-rose-300">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-sm disabled:opacity-60"
                >
                  {busy ? 'Sending...' : 'Send ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Shell                                                                     */
/* -------------------------------------------------------------------------- */

type Tab = 'profile' | 'payments' | 'complaints';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'profile', label: 'My Account' },
  { id: 'payments', label: 'Payments' },
  { id: 'complaints', label: 'Complaints' },
];

export const HomeScreen: React.FC<{ name: string; onSignOut: () => void }> = ({
  name,
  onSignOut,
}) => {
  const [tab, setTab] = useState<Tab>('profile');
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchPortal());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSignOut();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not load your account.');
    }
  }, [onSignOut]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950">
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 safe-area">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
              Trigon Links
            </p>
            <p className="text-sm font-black text-white truncate">{name}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="shrink-0 text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800"
          >
            Sign out
          </button>
        </div>

        <nav className="flex" role="tablist" aria-label="Sections">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-xs font-black border-b-2 transition-colors ${
                tab === id
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-500 border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-4 pb-8 max-w-lg w-full mx-auto">
        {error ? (
          <div className="rounded-2xl bg-rose-950/40 border border-rose-900/60 p-4 text-center">
            <p className="text-xs text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 text-xs font-bold text-white px-3 py-2 rounded-lg bg-slate-800"
            >
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : tab === 'profile' ? (
          <ProfileTab data={data} />
        ) : tab === 'payments' ? (
          <PaymentsTab data={data} />
        ) : (
          <ComplaintsTab data={data} onLodged={() => void load()} />
        )}
      </main>
    </div>
  );
};
