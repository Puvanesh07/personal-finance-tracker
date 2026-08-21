import {
  FiArrowLeft,
  FiClock,
  FiMail,
  FiMessageCircle,
  FiStar,
  FiZap,
} from 'react-icons/fi';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useFeedbackModalStore } from '../../store/feedbackModalStore';

function StatRow({
  label,
  value,
  accent = false,
  positive,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  let cls = 'text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100';
  if (positive === true) cls = 'text-sm font-bold tabular-nums text-emerald-400';
  if (positive === false) cls = 'text-sm font-bold tabular-nums text-rose-400';
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${accent ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-100/90 dark:bg-slate-800/40 hover:bg-slate-200 dark:bg-slate-800/70'} transition-colors`}
    >
      <span className='text-sm text-slate-500 dark:text-slate-400'>{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  color,
  fullWidth = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 p-5 flex flex-col gap-4 ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2.5'>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}
          >
            {icon}
          </div>
          <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>
            {title}
          </h2>
        </div>
      </div>
      <div
        className={`flex flex-col gap-2 ${fullWidth ? 'md:flex-row md:gap-6' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const openFeedback = useFeedbackModalStore((s) => s.open);
  const navigate = useNavigate();

  return (
    <div className='flex flex-col gap-6 pb-10 animate-in fade-in duration-300'>
      <button
        type='button'
        onClick={() => navigate(-1)}
        className='flex w-fit items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors -ml-1'
        aria-label='Go back'
      >
        <FiArrowLeft className='h-4 w-4' />
        Back
      </button>

      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-6 border border-amber-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'>
            <FiMessageCircle className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              💬 Feedback & Support
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Your voice shapes the future of Fintrackly
            </p>
          </div>
        </div>
      </header>

      <div className='rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5'>
        <p className='text-sm font-semibold text-amber-700 dark:text-amber-400 leading-relaxed'>
          This page opens the feedback dialog. You can also access feedback from
          any page using the button below.
        </p>
      </div>

      <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-950 p-8 md:p-12'>
        <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-500/30 mb-5'>
          <FiMessageCircle className='h-8 w-8' />
        </div>
        <h2 className='text-xl font-black text-slate-900 dark:text-white text-center mb-2'>
          Share Your Thoughts
        </h2>
        <p className='text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-6'>
          Spotted a bug? Have an idea to make Fintrackly better? We read
          every single piece of feedback — seriously.
        </p>
        <button
          onClick={() => openFeedback()}
          className='inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-base font-black text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer'
        >
          <FiZap className='h-5 w-5' /> Open Feedback Form
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
        <SectionCard
          icon={<FiStar className='h-5 w-5 text-rose-400' />}
          title='How to Report a Bug'
          color='bg-rose-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              Help us squash bugs quickly by providing clear reproduction
              steps. Screenshots are incredibly helpful too!
            </p>
            <StatRow label='Category' value='🐛 Bug Report' accent />
            <StatRow label='Steps to Reproduce' value='Include' positive />
            <StatRow label='Expected Behavior' value='Describe' />
            <StatRow label='Screenshots' value='Attach if possible' positive />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiZap className='h-5 w-5 text-violet-400' />}
          title='Feature Request Guidelines'
          color='bg-violet-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              Great feature requests explain the problem first, then propose a
              solution. The more context the better!
            </p>
            <StatRow label='Category' value='✨ Feature Request' accent />
            <StatRow label='Use Case' value='Explain the "why"' positive />
            <StatRow label='Pain Point' value='Describe clearly' />
            <StatRow label='Ideas Welcome' value='Suggest solution' positive />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiClock className='h-5 w-5 text-emerald-400' />}
          title='Response Times'
          color='bg-emerald-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Bug Reports (Critical)' value='< 24 hours' accent positive />
            <StatRow label='Feature Requests' value='48-72 hours' positive />
            <StatRow label='General Feedback' value='Read on arrival' positive />
            <StatRow label='Other Inquiries' value='24-48 hours' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiMail className='h-5 w-5 text-sky-400' />}
          title='Support Email'
          color='bg-sky-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              Prefer email? Reach us directly at any time. We respond on
              business days within 24-48 hours.
            </p>
            <StatRow label='Support Email' value='fintracklysupport@gmail.com' accent />
            <StatRow label='Business Days' value='Monday – Friday' />
            <StatRow label='Time Zone' value='IST (UTC+5:30)' />
            <StatRow label='Reply Guarantee' value='Every email answered' positive />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
