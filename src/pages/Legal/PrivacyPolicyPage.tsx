import {
  FiDatabase,
  FiEye,
  FiGlobe,
  FiLock,
  FiMail,
  FiArrowLeft,
  FiRefreshCw,
  FiShield,
  FiShieldOff,
  FiUsers,
} from 'react-icons/fi';
import React from 'react';
import { useNavigate } from 'react-router-dom';

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

export function PrivacyPolicyPage() {
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

      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-6 border border-violet-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-lg shadow-violet-500/30'>
            <FiLock className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              🔒 Privacy Policy
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Last updated: August 2026
            </p>
          </div>
        </div>
      </header>

      <div className='rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5'>
        <p className='text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed'>
          Fintrackly takes a privacy-first approach to your sensitive
          financial and net-worth data. All data is encrypted using AES-256-GCM
          before it leaves your device. We never sell, share, or monetize your
          personal financial information.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='rounded-2xl p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Encryption Standard
          </p>
          <p className='text-3xl font-black tabular-nums mt-2 text-violet-600 dark:text-violet-400'>
            AES-256
          </p>
          <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>
            Military-grade encryption
          </p>
        </div>
        <div className='rounded-2xl p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Data Sharing
          </p>
          <p className='text-3xl font-black tabular-nums mt-2 text-emerald-600 dark:text-emerald-400'>
            Zero
          </p>
          <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>
            Never sold or shared
          </p>
        </div>
        <div className='rounded-2xl p-5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Tracking
          </p>
          <p className='text-3xl font-black tabular-nums mt-2 text-sky-600 dark:text-sky-400'>
            Minimal
          </p>
          <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-1'>
            Only essential analytics
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
        <SectionCard
          icon={<FiShield className='h-5 w-5 text-violet-400' />}
          title='Our Commitment to Privacy'
          color='bg-violet-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              At Fintrackly, we believe that your financial data is among
              your most personal and sensitive information. Our commitment is to
              treat your data with the highest level of respect, security, and
              confidentiality. Every architectural and design decision we make
              begins with the question: "What is the most privacy-preserving way
              to do this?"
            </p>
            <StatRow
              label='Data Encrypted at Rest'
              value='Always'
              accent
              positive
            />
            <StatRow
              label='Data Encrypted in Transit'
              value='TLS 1.3+'
              positive
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiDatabase className='h-5 w-5 text-indigo-400' />}
          title='Information We Collect'
          color='bg-indigo-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Account Email' value='For auth only' />
            <StatRow label='Display Name' value='Optional profile' />
            <StatRow label='Profile Photo' value='Google auth (optional)' />
            <StatRow
              label='Financial Records'
              value='User-owned, encrypted'
              accent
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiEye className='h-5 w-5 text-sky-400' />}
          title='How We Use Your Data'
          color='bg-sky-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Service Provision' value='Core functionality' positive />
            <StatRow label='Personalization' value='Your preferences' />
            <StatRow label='Security Audits' value='Protect your account' />
            <StatRow
              label='Advertising / Selling'
              value='Never'
              accent
              positive
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiLock className='h-5 w-5 text-emerald-400' />}
          title='Data Encryption & Security'
          color='bg-emerald-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Client-Side Encryption' value='AES-256-GCM' accent positive />
            <StatRow label='Transport Layer' value='TLS 1.3' positive />
            <StatRow label='Cloud Storage' value='Encrypted volumes' positive />
            <StatRow label='Zero-Knowledge Ready' value='In roadmap' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiGlobe className='h-5 w-5 text-amber-400' />}
          title='Third-Party Services'
          color='bg-amber-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Firebase (Auth & DB)' value='Google Cloud' />
            <StatRow label='Google Sign-In' value='OAuth 2.0' />
            <StatRow label='Analytics' value='Anonymized, opt-out' />
            <StatRow
              label='3rd-Party Data Sales'
              value='None. Ever.'
              accent
              positive
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiUsers className='h-5 w-5 text-pink-400' />}
          title='Your Data Rights'
          color='bg-pink-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Access Your Data' value='Export anytime' positive />
            <StatRow label='Correct Inaccuracies' value='Edit in-app' positive />
            <StatRow label='Delete Your Data' value='Full wipe, right to be forgotten' positive />
            <StatRow
              label='Data Portability'
              value='CSV / JSON export'
              accent
              positive
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiMail className='h-5 w-5 text-blue-400' />}
          title='Contact & Data Requests'
          color='bg-blue-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              For any privacy-related inquiries, data access requests, data
              deletion requests, or questions about how your data is handled,
              please reach out to our privacy team directly. We respond to all
              legitimate requests within 7 business days.
            </p>
            <StatRow label='Privacy Email' value='fintracklysupport@gmail.com' accent />
            <StatRow label='Response Time' value='24-48 hours' positive />
            <StatRow label='Data Deletion SLA' value='Within 14 days' positive />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiShield className='h-5 w-5 text-teal-400' />}
          title="Children's Privacy"
          color='bg-teal-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Age Requirement' value='13+ years old' />
            <StatRow label='COPPA Compliant' value='Yes' accent positive />
            <StatRow label='Intentional Collection' value='None' positive />
            <StatRow label='Parental Concerns' value='Contact us immediately' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiRefreshCw className='h-5 w-5 text-orange-400' />}
          title='Policy Updates'
          color='bg-orange-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Notification Method' value='In-app + Email' />
            <StatRow label='Review Window' value='30 days notice' />
            <StatRow label='Material Changes' value='Always announced' accent />
            <StatRow label='Policy Version' value='v1.0 · August 2026' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiShieldOff className='h-5 w-5 text-rose-400' />}
          title='Governing Law'
          color='bg-rose-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              This Privacy Policy is governed by and construed in accordance
              with the laws of the Republic of India, without regard to its
              conflict of law provisions. Any dispute arising from this policy
              shall be subject to the exclusive jurisdiction of the courts
              located in Tamil Nadu, India.
            </p>
            <StatRow label='Governing Country' value='India' accent />
            <StatRow label='Jurisdiction' value='Tamil Nadu' />
            <StatRow label='Effective Date' value='August 01, 2026' positive />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
