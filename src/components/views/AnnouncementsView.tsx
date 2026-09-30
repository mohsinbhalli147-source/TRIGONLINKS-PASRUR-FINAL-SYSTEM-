import React, { useState } from 'react';
import { Megaphone, Plus, Bell, Calendar, Users, Send } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StorageService } from '../../services/storage';

interface AnnouncementItem {
  id: string;
  title: string;
  category: 'Maintenance' | 'Promotion' | 'General';
  audience: string;
  date: string;
  content: string;
  active: boolean;
}

const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    title: 'Upstream Optical Ring Scheduled Maintenance',
    category: 'Maintenance',
    audience: 'All Subscribers in Gulberg & DHA',
    date: '2026-09-24',
    content: 'Please be advised that emergency optical fiber core splicing will be carried out tonight between 02:00 AM and 04:00 AM. Internet connectivity may experience brief interruptions.',
    active: true,
  },
  {
    id: 'ann-2',
    title: 'JazzCash & EasyPaisa Auto-Debit Integration Live',
    category: 'Promotion',
    audience: 'All Subscribers',
    date: '2026-09-18',
    content: 'Subscribers can now pay monthly bills instantly using the JazzCash App QR Code or EasyPaisa Bill Payment under "Trigon Links Broadband". Direct instant receipt generation.',
    active: true,
  },
];

export const AnnouncementsView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Maintenance' | 'Promotion' | 'General'>('Maintenance');
  const [audience, setAudience] = useState('All Subscribers');
  const [content, setContent] = useState('');

  const openAdd = () => {
    setTitle('');
    setCategory('Maintenance');
    setAudience('All Subscribers');
    setContent('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    const newAnn: AnnouncementItem = {
      id: `ann-${Date.now()}`,
      title,
      category,
      audience,
      date: new Date().toISOString().split('T')[0],
      content,
      active: true,
    };

    setAnnouncements([newAnn, ...announcements]);
    StorageService.logActivity(user?.email || 'admin@trigonlinks.pk', user?.name || 'Staff', 'Broadcast Announcement', 'announcements', `Published announcement: "${title}"`);
    showToast('success', 'Announcement Published', `Broadcasted to ${audience}.`);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-amber-400" />
            Network Announcements &amp; Broadcasts
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Public notices, scheduled optical core maintenance windows, and customer promotional packages
          </p>
        </div>

        <button
           type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs shadow-lg shadow-cyan-950/40"
        >
          <Plus className="w-4 h-4" />
          + Create Announcement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    ann.category === 'Maintenance'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : ann.category === 'Promotion'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}
                >
                  {ann.category}
                </span>
                <span className="text-[11px] font-mono text-slate-500">{ann.date}</span>
              </div>

              <h3 className="text-base font-bold text-white mt-3">{ann.title}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{ann.content}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                {ann.audience}
              </span>
              <span className="text-emerald-400 font-bold">Active Broadcast</span>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsModalOpen(false)}
          title="Post Broadcast Announcement"
        >
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label htmlFor="headline-title" className="block text-slate-300 font-bold mb-1">Headline Title *</label>
              <input
                 id="headline-title"
                type="text"
                required
                placeholder="e.g. Scheduled Network Maintenance"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="notice-category" className="block text-slate-300 font-bold mb-1">Notice Category</label>
                <select
                   id="notice-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Maintenance">Maintenance Alert</option>
                  <option value="Promotion">Promotional Tariff</option>
                  <option value="General">General Notice</option>
                </select>
              </div>

              <div>
                <label htmlFor="target-audience" className="block text-slate-300 font-bold mb-1">Target Audience</label>
                <input
                   id="target-audience"
                  type="text"
                  required
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="All Subscribers or Gulberg"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="notice-content" className="block text-slate-300 font-bold mb-1">Notice Content *</label>
              <textarea
                 id="notice-content"
                rows={4}
                required
                placeholder="Details of downtime or promotion..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
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
                Publish Notice
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
