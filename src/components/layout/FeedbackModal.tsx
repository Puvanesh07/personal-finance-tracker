import { FiCheckCircle, FiMail } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Modal } from '../ui/Modal';
import { auth } from '../../services/firebase';
import { useFeedbackModalStore } from '../../store/feedbackModalStore';

type FeedbackCategory = 'bug' | 'feature' | 'general' | 'other';

const CATEGORIES: Array<{ id: FeedbackCategory; label: string; icon: string; chipColor: string }> = [
  { id: 'bug', label: 'Bug Report', icon: '🐛', chipColor: 'bg-rose-500' },
  { id: 'feature', label: 'Feature Request', icon: '✨', chipColor: 'bg-violet-500' },
  { id: 'general', label: 'General Feedback', icon: '💬', chipColor: 'bg-emerald-500' },
  { id: 'other', label: 'Other', icon: 'ℹ️', chipColor: 'bg-sky-500' },
];

const APP_VERSION = '0.0.0';
const SUPPORT_EMAIL = 'fintracklysupport@gmail.com';

export function FeedbackModal() {
  const { isOpen, close } = useFeedbackModalStore();
  const user = auth.currentUser;

  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCategory('general');
      setMessage('');
      setEmail(user?.email || '');
      setSubmitting(false);
    }
  }, [isOpen, user?.email]);

  const categoryLabel = (id: FeedbackCategory) =>
    CATEGORIES.find((c) => c.id === id)?.label || id;

  const categorySubjectTag = (id: FeedbackCategory) => {
    switch (id) {
      case 'bug': return 'Bug Report';
      case 'feature': return 'Feature Request';
      case 'general': return 'General Feedback';
      case 'other': return 'Other';
    }
  };

  const buildMailtoUrl = () => {
    const subject = encodeURIComponent(
      `[Feedback][${categorySubjectTag(category)}] ${message.split('\n')[0]?.slice(0, 60) || categorySubjectTag(category)}`,
    );
    const userName = user?.displayName || 'N/A';
    const userEmail = (email || user?.email || 'N/A').trim();
    const dateTime = new Date().toString();
    const body = encodeURIComponent(
      `Fintrackly — Feedback Submission\n` +
      `=================================\n\n` +
      `User Name: ${userName}\n` +
      `User Email: ${userEmail}\n` +
      `Date / Time: ${dateTime}\n` +
      `Category: ${categoryLabel(category)}\n` +
      `App Version: ${APP_VERSION}\n\n` +
      `Message:\n` +
      `---------------------------------\n` +
      `${message || '(no message provided)'}\n`,
    );
    return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please describe your feedback before submitting.');
      return;
    }
    if (!category) {
      toast.error('Please select a feedback category.');
      return;
    }

    try {
      setSubmitting(true);
      toast.success('Feedback submitted successfully — thank you!', {
        icon: <FiCheckCircle className='h-4 w-4 text-emerald-500' />,
        duration: 4000,
      });
      const mailto = buildMailtoUrl();
      try {
        window.open(mailto, '_blank', 'noopener,noreferrer');
      } catch {
        window.location.href = mailto;
      }
      setTimeout(() => {
        close();
      }, 250);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => !submitting && close()}
      title='💬 Share Your Feedback'
    >
      <div className='space-y-5'>
        <div className='rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 px-4 py-3'>
          <p className='text-xs font-semibold text-amber-700 dark:text-amber-400 leading-relaxed'>
            Thank you for taking the time to share feedback! Every message is
            read by the team — we truly appreciate it. 🙏
          </p>
        </div>

        <div>
          <label className='mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Category
          </label>
          <div className='flex flex-wrap gap-2'>
            {CATEGORIES.map((c) => {
              const isSelected = category === c.id;
              return (
                <button
                  key={c.id}
                  type='button'
                  onClick={() => setCategory(c.id)}
                  className={`group flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition-all cursor-pointer ${
                    isSelected
                      ? `${c.chipColor} text-white shadow-lg scale-[1.02]`
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className='text-base leading-none'>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className='mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            <span>Your Message</span>
            <span className={`text-[10px] font-bold ${message.trim() ? 'text-emerald-500' : 'text-rose-500'}`}>
              {message.trim() ? message.length + ' chars' : 'Required'}
            </span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Tell us what happened, what you expected, or what you’d love to see…'
            rows={6}
            className='w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20'
            required
          />
          <div className='mt-1.5 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400'>
            <FiCheckCircle className='h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500' />
            <span>
              Include reproduction steps for bugs, or the "why" behind feature ideas.
            </span>
          </div>
        </div>

        <div>
          <label className='mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            <span>Email (optional)</span>
            <span className='text-[10px] font-normal'>For follow-up replies</span>
          </label>
          <div className='relative'>
            <FiMail className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400' />
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='you@example.com'
              className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20'
            />
          </div>
          {user?.email && email === user.email && (
            <p className='mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400'>
              <FiCheckCircle className='h-3 w-3' /> Prefilled with your account email
            </p>
          )}
        </div>

        <div className='flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            onClick={() => !submitting && close()}
            disabled={submitting}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className='inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-7 py-2.5 text-sm font-black text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer'
          >
            <FiCheckCircle className='h-4 w-4' />
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>

        <div className='flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500'>
          <FiMail className='h-3 w-3' />
          <span>
            Submission opens your email client to{' '}
            <span className='font-bold text-slate-500 dark:text-slate-400'>{SUPPORT_EMAIL}</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}
