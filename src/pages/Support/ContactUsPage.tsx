import {
  FiAlertCircle,
  FiCalendar,
  FiMail,
  FiMapPin,
  FiZap,
} from 'react-icons/fi';
import React from 'react';

import { useFeedbackModalStore } from '../../store/feedbackModalStore';

function ContactCard({
  icon,
  title,
  description,
  actionText,
  actionHref,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onClick?: () => void;
  tone?: 'default' | 'email' | 'bug' | 'feature' | 'hours' | 'love';
}) {
  const toneStyles: Record<string, { iconBg: string; border: string; accent: string; btn: string }> = {
    default: {
      iconBg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      accent: 'text-sky-400',
      btn: 'bg-sky-500 hover:bg-sky-600',
    },
    email: {
      iconBg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      accent: 'text-sky-500',
      btn: 'bg-sky-500 hover:bg-sky-600',
    },
    bug: {
      iconBg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      accent: 'text-rose-500',
      btn: 'bg-rose-500 hover:bg-rose-600',
    },
    feature: {
      iconBg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      accent: 'text-violet-500',
      btn: 'bg-violet-500 hover:bg-violet-600',
    },
    hours: {
      iconBg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      accent: 'text-emerald-500',
      btn: 'bg-emerald-500 hover:bg-emerald-600',
    },
    love: {
      iconBg: 'bg-pink-500/10',
      border: 'border-pink-500/20',
      accent: 'text-pink-500',
      btn: 'bg-pink-500 hover:bg-pink-600',
    },
  };
  const s = toneStyles[tone];
  const Wrapper: any = actionHref && !onClick ? 'a' : 'div';
  const wrapperProps = actionHref && !onClick
    ? { href: actionHref, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`rounded-2xl border ${s.border} bg-slate-100/80 dark:bg-slate-900/60 p-5 flex flex-col gap-4 transition-all hover:scale-[1.01] ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
            {icon}
          </div>
          <h3 className={`text-lg font-black text-slate-900 dark:text-slate-100 ${s.accent}`}>
            {title}
          </h3>
        </div>
      </div>
      <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
        {description}
      </p>
      {(actionText || actionHref) && (
        <div className='pt-1'>
          {onClick || actionHref ? (
            <button
              onClick={onClick}
              className={`inline-flex items-center gap-1.5 rounded-lg ${s.btn} px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all cursor-pointer`}
            >
              {actionText || (tone === 'bug' || tone === 'feature' ? 'Open Feedback' : 'Email Us')}
              <FiMapPin className='h-3.5 w-3.5 opacity-80' />
            </button>
          ) : (
            <div className={`text-xs font-bold ${s.accent} uppercase tracking-wider`}>
              {actionText}
            </div>
          )}
        </div>
      )}
    </Wrapper>
  );
}

export function ContactUsPage() {
  const openFeedback = useFeedbackModalStore((s) => s.open);

  return (
    <div className='flex flex-col gap-6 pb-10 animate-in fade-in duration-300'>
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent p-6 border border-sky-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30'>
            <FiMapPin className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              📞 Contact Us
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              We're here to help — reach out through any channel
            </p>
          </div>
        </div>
      </header>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
        <ContactCard
          icon={<FiMail className='h-5 w-5 text-sky-500' />}
          title='📧 Email Support'
          description='For general questions, account issues, or detailed conversations. We typically respond within 24-48 hours on business days.'
          tone='email'
          actionHref='mailto:fintracklysupport@gmail.com'
          actionText='Email Us'
        />

        <ContactCard
          icon={<FiAlertCircle className='h-5 w-5 text-rose-500' />}
          title='🐛 Bug Reports'
          description='Found something broken? Use the feedback form and select the "Bug Report" category for fastest triage. Include reproduction steps!'
          tone='bug'
          onClick={() => openFeedback()}
          actionText='Report Bug'
        />

        <ContactCard
          icon={<FiZap className='h-5 w-5 text-violet-500' />}
          title='💡 Feature Requests'
          description='Have a brilliant idea to make Fintrackly better? Use the feedback form and select "Feature Request" — we read every one.'
          tone='feature'
          onClick={() => openFeedback()}
          actionText='Suggest Feature'
        />

        <ContactCard
          icon={<FiCalendar className='h-5 w-5 text-emerald-500' />}
          title='📋 Business Hours'
          description="Monday — Friday: 9:00 AM — 6:00 PM IST. We're closed on weekends and major Indian public holidays. Support emails are queued and answered next business day."
          tone='hours'
          actionText='Mon–Fri · 9am–6pm IST'
        />

        <div className='sm:col-span-2 lg:col-span-2 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent p-6 flex flex-col sm:flex-row items-center gap-5 hover:scale-[1.01] transition-all'>
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-xl shadow-pink-500/30'>
            <span className='text-3xl'>🇮🇳</span>
          </div>
          <div className='flex-1 text-center sm:text-left'>
            <h3 className='text-xl font-black text-slate-900 dark:text-white mb-1'>
              Made with <span className='text-rose-500'>❤️</span> in India
            </h3>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg'>
              Fintrackly is built with love by a small, passionate team
              across Tamil Nadu and Karnataka. Your data stays on servers that
              respect your privacy, and every subscription supports local
              talent. Thank you for trusting us with your financial journey —
              we won't let you down. 🙏
            </p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='rounded-2xl p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Primary Support
          </p>
          <p className='text-xl font-black tabular-nums mt-2 text-sky-600 dark:text-sky-400 break-all'>
            fintracklysupport@gmail.com
          </p>
          <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>
            Preferred channel for all inquiries
          </p>
        </div>
        <div className='rounded-2xl p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Avg. Response Time
          </p>
          <p className='text-3xl font-black tabular-nums mt-2 text-emerald-600 dark:text-emerald-400'>
            24-48h
          </p>
          <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>
            On business days · Mon–Fri
          </p>
        </div>
        <div className='rounded-2xl p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Time Zone
          </p>
          <p className='text-3xl font-black tabular-nums mt-2 text-violet-600 dark:text-violet-400'>
            UTC+5:30
          </p>
          <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>
            Indian Standard Time (IST)
          </p>
        </div>
      </div>
    </div>
  );
}
