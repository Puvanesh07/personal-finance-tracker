import {
  FiAlertTriangle,
  FiAward,
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiCreditCard,
  FiFileText,
  FiGlobe,
  FiKey,
  FiMail,
  FiShieldOff,
  FiStopCircle,
  FiXCircle,
  FiZap,
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

export function TermsPage() {
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
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 text-white shadow-lg shadow-violet-500/30'>
            <FiFileText className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              📜 Terms & Conditions
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Effective date: August 01, 2026
            </p>
          </div>
        </div>
      </header>

      <div className='rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5'>
        <p className='text-sm font-semibold text-indigo-700 dark:text-indigo-400 leading-relaxed'>
          Please read these Terms & Conditions carefully before using Finance
          Boosan. By accessing or using our service, you agree to be bound by
          the terms described below.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
        <SectionCard
          icon={<FiZap className='h-5 w-5 text-violet-400' />}
          title='Acceptance of Terms'
          color='bg-violet-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              By creating an account, signing in, or otherwise accessing or
              using Fintrackly's services, you acknowledge that you have
              read, understood, and agree to be bound by these Terms &
              Conditions and our Privacy Policy. If you do not agree to any part
              of these terms, you must discontinue use immediately.
            </p>
            <StatRow label='Acceptance Required' value='To use service' accent />
            <StatRow label='Age Requirement' value='13 years minimum' />
            <StatRow label='Legal Capacity' value='Required' positive />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiBriefcase className='h-5 w-5 text-indigo-400' />}
          title='Service Description'
          color='bg-indigo-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Primary Service' value='Personal finance tracker' />
            <StatRow label='Investment Tracking' value='Included' positive />
            <StatRow label='Net-Worth Analysis' value='Included' positive />
            <StatRow label='Advanced Reports' value='Premium feature' accent />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiKey className='h-5 w-5 text-sky-400' />}
          title='User Responsibilities'
          color='bg-sky-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Accurate Information' value='Your responsibility' />
            <StatRow label='Maintain Confidentiality' value='Account credentials' accent />
            <StatRow label='Compliance with Laws' value='Your jurisdiction' />
            <StatRow label='Backups' value='Recommended' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiShieldOff className='h-5 w-5 text-emerald-400' />}
          title='Account Security'
          color='bg-emerald-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Strong Password' value='Required' accent positive />
            <StatRow label='Two-Factor Auth' value='Supported' positive />
            <StatRow label='Suspicious Activity' value='Report immediately' />
            <StatRow label='Unauthorized Access' value='Notify us within 24h' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiCreditCard className='h-5 w-5 text-amber-400' />}
          title='Subscription & Billing'
          color='bg-amber-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Billing Cycle' value='Monthly / Annual' />
            <StatRow label='Auto-Renewal' value='Enabled by default' />
            <StatRow label='Payment Methods' value='UPI, Cards, Netbanking' />
            <StatRow label='Prorated Charges' value='Not applicable' accent />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiCalendar className='h-5 w-5 text-pink-400' />}
          title='Free Trial Policy'
          color='bg-pink-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Trial Duration' value='30 days' accent positive />
            <StatRow label='Trial Features' value='All premium features' positive />
            <StatRow label='Payment Requirement' value='None to start' positive />
            <StatRow label='Trial Extensions' value='Rare exceptions only' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiAward className='h-5 w-5 text-teal-400' />}
          title='Refund Policy'
          color='bg-teal-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              We want you to be satisfied with Fintrackly. Annual
              subscriptions are eligible for a prorated refund within 14 days of
              purchase if you have not used advanced features extensively.
              Monthly subscriptions are generally non-refundable but reviewed on
              a case-by-case basis. Contact our support team for refund
              requests.
            </p>
            <StatRow label='Monthly Refunds' value='Case by case' />
            <StatRow label='Annual Refund Window' value='14 days' accent />
            <StatRow label='Refund Method' value='Original payment method' positive />
            <StatRow label='Processing Time' value='5-10 business days' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiXCircle className='h-5 w-5 text-rose-400' />}
          title='User Conduct & Restrictions'
          color='bg-rose-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Reverse Engineering' value='Prohibited' positive={false} />
            <StatRow label='Sharing Account Access' value='Prohibited' positive={false} accent />
            <StatRow label='Illegal Activities' value='Zero tolerance' positive={false} />
            <StatRow label='Hacking / Abuse' value='Termination' positive={false} />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiFileText className='h-5 w-5 text-blue-400' />}
          title='Intellectual Property'
          color='bg-blue-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Brand & Logos' value='© Fintrackly' accent />
            <StatRow label='Software License' value='Per user, non-transferable' />
            <StatRow label='User-Financial Data' value='Owned by user' positive />
            <StatRow label='User Feedback' value='May be used to improve service' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiAlertTriangle className='h-5 w-5 text-orange-400' />}
          title='Disclaimer of Warranties'
          color='bg-orange-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              Fintrackly is provided "AS IS" and "AS AVAILABLE" without
              warranties of any kind. We do not warrant that the service will
              be uninterrupted, error-free, secure, or accurate. All financial
              data, insights, and projections are for informational purposes
              only and should not be construed as financial, tax, or legal
              advice. Always consult a qualified professional for financial
              decisions.
            </p>
            <StatRow label='Investment Advice' value='Not provided' accent />
            <StatRow label='Data Accuracy' value='Best effort' />
            <StatRow label='Service Uptime' value='No 100% guarantee' />
            <StatRow label='Financial Decisions' value='Your sole responsibility' positive={false} />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiStopCircle className='h-5 w-5 text-fuchsia-400' />}
          title='Limitation of Liability'
          color='bg-fuchsia-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              To the maximum extent permitted by applicable law, Fintrackly
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, including without limitation
              loss of profits, data, or business interruption, arising from
              your use or inability to use the service, even if advised of the
              possibility of such damages. Our total aggregate liability shall
              not exceed the total amounts actually paid by you for the service
              during the twelve (12) months preceding the claim.
            </p>
            <StatRow label='Max Liability Cap' value='12 months of fees paid' accent />
            <StatRow label='Consequential Damages' value='Excluded' />
            <StatRow label='Data Loss Liability' value='Service credits only' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiXCircle className='h-5 w-5 text-red-400' />}
          title='Termination'
          color='bg-red-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='By User' value='Anytime, no fee' accent positive />
            <StatRow label='By Us (Breach)' value='Immediate, no refund' />
            <StatRow label='By Us (Legal)' value='Upon court order' />
            <StatRow label='Post-Termination Access' value='30-day export window' positive />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiCalendar className='h-5 w-5 text-purple-400' />}
          title='Changes to Terms'
          color='bg-purple-500/10'
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow label='Notification' value='30 days advance' accent positive />
            <StatRow label='Major Changes' value='Explicit consent required' positive />
            <StatRow label='Minor Changes' value='Effective on posting' />
            <StatRow label='Continued Use' value='Deemed acceptance' />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiMail className='h-5 w-5 text-cyan-400' />}
          title='Contact'
          color='bg-cyan-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              Questions, concerns, or complaints about these Terms? Reach out to
              our support team. We take every communication seriously and
              respond within 24-48 business hours.
            </p>
            <StatRow label='Support Email' value='fintracklysupport@gmail.com' accent />
            <StatRow label='Response Time' value='24-48 business hours' positive />
          </div>
        </SectionCard>

        <SectionCard
          icon={<FiGlobe className='h-5 w-5 text-slate-400' />}
          title='Governing Law'
          color='bg-slate-500/10'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
              These Terms & Conditions and any disputes arising out of or in
              connection with them shall be governed by and construed in
              accordance with the laws of the Republic of India. The courts of
              Tamil Nadu, India shall have exclusive jurisdiction over any
              dispute, claim, or proceeding arising out of or relating to these
              Terms.
            </p>
            <StatRow label='Country' value='India' accent />
            <StatRow label='State / Region' value='Tamil Nadu' />
            <StatRow label='Conflict of Laws' value='Indian law prevails' />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
