// src/pages/Auth/AuthPage.tsx
import { auth, googleProvider } from '../../src/services/firebase';
import { signInWithPopup } from 'firebase/auth';
import { motion, type Variants } from 'framer-motion';
import { useState } from 'react';
import {
  FiTrendingUp,
  FiFileText,
  FiLock,
  FiDownload,
  FiBarChart2,
  FiShield,
  FiCheck,
  FiArrowRight,
  FiUpload,
  FiPackage,
  FiCamera,
  FiCreditCard,
  FiBriefcase,
  FiAlertCircle,
  FiZap,
  FiActivity,
  FiFlag,
  FiSettings,
  FiDatabase,
  FiGlobe,
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { SiNotion } from 'react-icons/si';
import { BsBank2 } from 'react-icons/bs';
import { GiWheat } from 'react-icons/gi';

// ── Animation Variants ────────────────────────────────────────────────────────

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// ── Data ──────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: <FiBarChart2 />,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.25)',
    label: 'Dashboard',
    desc: 'Unified portfolio overview with net worth summary cards, asset allocation donut charts, maturity timeline for FDs & bonds, sector allocation, market-cap breakdown, goals progress, and a full net worth growth chart across snapshots.',
    bullets: [
      'Net worth, assets & liabilities summary cards',
      'Asset allocation & maturity timeline charts',
      'Sector & market-cap breakdown charts',
      'Goals progress summary panel',
      'Net worth growth chart over time',
    ],
  },
  {
    icon: <FiActivity />,
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.25)',
    label: 'Cashflow',
    desc: 'Track monthly income and expenses with a month picker, summary metric cards (income, expenses, savings rate), and a full transaction table with edit/delete per entry.',
    bullets: [
      'Month-by-month cashflow view',
      'Income, expense & savings rate metrics',
      'Add, edit & delete transactions',
      'Categorized entries (income / expense)',
      '12-month history rolling picker',
    ],
  },
  {
    icon: <FiBriefcase />,
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.25)',
    label: 'Investments',
    desc: 'Full portfolio management for Stocks, Mutual Funds, Bonds, Fixed Deposits, Gold, Crypto, PPF, NPS, and more. Filter by type, search by name/symbol/platform, and view P&L per holding.',
    bullets: [
      'Stocks, MFs, Bonds, FDs, Gold, Silver, Crypto, PPF, NPS',
      'Search & filter by asset type',
      'Invested vs current value with P&L per row',
      'Import from Zerodha, Angel One, Groww, INDmoney',
      'Manual add / edit / delete with rich form',
    ],
  },
  {
    icon: <FiCreditCard />,
    color: '#f87171',
    glow: 'rgba(248,113,113,0.25)',
    label: 'Liabilities',
    desc: 'Log all loans and outstanding debts — home loans, car loans, credit cards, personal loans. See total outstanding balance and interest rates at a glance.',
    bullets: [
      'Track home, car, personal loans & credit cards',
      'Outstanding amount & interest rate per liability',
      'Total outstanding debt summary card',
      'Add, edit & delete liabilities',
      'Supports custom liability types',
    ],
  },
  {
    icon: <FiFlag />,
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.25)',
    label: 'Goals',
    desc: 'Set financial milestones with a target amount, current progress, and due date. Visual progress bars show how close you are to each goal.',
    bullets: [
      'Create goals with target amount & due date',
      'Auto-calculated progress percentage bar',
      'Current vs target amount tracking',
      'Add, edit & delete goals anytime',
      'Supports retirement, home, education & custom goals',
    ],
  },
  {
    icon: <FiCamera />,
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.25)',
    label: 'Snapshots',
    desc: 'Freeze your portfolio state at any moment with a labelled snapshot. Each snapshot records total assets, total liabilities, and net worth — building your wealth history over time.',
    bullets: [
      'One-click net worth snapshot creation',
      "Custom labels (e.g. 'Q3 End', 'Year Start')",
      'Timestamp, assets, liabilities & net worth logged',
      'Full snapshot history table',
      'Foundation for the growth chart on Dashboard',
    ],
  },
  {
    icon: <FiFileText />,
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.25)',
    label: 'Reports',
    desc: 'Generate and export your portfolio data. See portfolio summary, asset allocation breakdown, interest earnings on FDs & bonds, and export to CSV or Excel.',
    bullets: [
      'Portfolio summary: invested, current, P&L',
      'Asset allocation table by investment type',
      'Expected interest earnings for bonds & FDs',
      'Export investments as CSV',
      'Export investments as Excel (.xlsx)',
    ],
  },
  {
    icon: <SiNotion />,
    color: '#e2e8f0',
    glow: 'rgba(226,232,240,0.15)',
    label: 'Notion Sync',
    desc: 'Connect your Notion workspace via API token and database ID. Push investment data, expenses, goals and snapshots directly into your Notion databases — keeping your life OS up to date automatically.',
    bullets: [
      'Connect via Notion API token & database ID',
      'Push investments to a Notion database',
      'Sync monthly expense summaries',
      'Goal & snapshot sync support',
      'Serverless sync via Netlify functions',
    ],
  },
  {
    icon: <FiPackage />,
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.25)',
    label: 'Import / Export',
    desc: 'Import your portfolio from four major Indian platforms — no broker access needed. Export your complete data anytime for full portability.',
    bullets: [
      'Import from Zerodha (CSV format)',
      'Import from Angel One (PDF statement)',
      'Import from Groww (CSV format)',
      'Import from INDmoney (XLSX format)',
      'Export as CSV or Excel with P&L fields',
    ],
  },
  {
    icon: <FiShield />,
    color: '#34d399',
    glow: 'rgba(52,211,153,0.25)',
    label: 'Essentials & Safety',
    desc: 'Track your financial safety net: term insurance cover, health insurance cover, emergency fund target and current amount. Dashboard shows your coverage gaps at a glance.',
    bullets: [
      'Term insurance cover amount tracking',
      'Health cover amount tracking',
      'Emergency fund target vs saved',
      'Safety net summary on Dashboard',
      'Configured via Settings panel',
    ],
  },
  {
    icon: <FiDatabase />,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.25)',
    label: 'Data Management',
    desc: 'Full control over your data — backup everything as a JSON file and restore from backup at any time. One-click full data wipe if needed.',
    bullets: [
      'Export full data backup as JSON',
      'Restore from a previous JSON backup',
      'Wipe all data with one-click reset',
      'Firebase Firestore as secure cloud store',
      'All data scoped to your Google account',
    ],
  },
  {
    icon: <FiGlobe />,
    color: '#38bdf8',
    glow: 'rgba(56,189,248,0.25)',
    label: 'NSE Stock Data',
    desc: 'Built-in NSE stock metadata with sector and market-cap classification for 500+ Indian equities. Powers the sector allocation and market-cap charts on the dashboard automatically.',
    bullets: [
      '500+ NSE stock symbols pre-loaded',
      'Sector classification per stock',
      'Market-cap category (Large / Mid / Small)',
      'Auto-populates allocation charts',
      'No API key needed — data bundled in-app',
    ],
  },
  {
    icon: <BsBank2 />,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.25)',
    label: 'Accounts',
    desc: 'Track all your bank accounts and credit cards in one place. See total liquid balance, account-wise breakdown with a donut chart, and a bar chart comparing balances across all accounts.',
    bullets: [
      'Add bank accounts & credit cards',
      'Per-account balance tracking',
      'Total liquid balance summary card',
      'Donut & bar chart breakdown',
      'Add, edit & delete accounts anytime',
    ],
  },
  {
    icon: <GiWheat />,
    color: '#84cc16',
    glow: 'rgba(132,204,22,0.25)',
    label: 'Agriculture',
    desc: 'A dedicated farm management module for Indian farmers. Track crop cycles, farm expenses, livestock, daily milk records, and coconut harvest — with P&L analytics per season.',
    bullets: [
      'Crop cycle tracking with season & P&L',
      'Farm expense categories (seeds, labor, fuel…)',
      'Livestock register with events log',
      'Daily milk production & sales records',
      'Coconut harvest & selling tracker',
    ],
  },
];

const glassBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  };

  return (
    <div
      className='min-h-screen overflow-x-hidden'
      style={{
        background: '#020b18',
        color: '#e2e8f0',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* ── STATIC BG — pure CSS, zero JS cost ── */}
      <div className='fixed inset-0 pointer-events-none' style={{ zIndex: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(16,185,129,0.14) 0%, transparent 65%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 55% 40% at 95% 80%, rgba(59,130,246,0.09) 0%, transparent 55%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 45% 35% at 0% 55%, rgba(167,139,250,0.08) 0%, transparent 55%)',
          }}
        />
      </div>

      {/* ── NAVBAR ── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className='fixed top-0 w-full z-50'
        style={{
          background: 'rgba(2,11,24,0.75)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className='flex items-center justify-between px-6 py-4 max-w-6xl mx-auto'>
          <div className='flex items-center gap-2.5'>
            <div
              className='h-8 w-8 rounded-lg flex items-center justify-center'
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 0 14px rgba(16,185,129,0.45)',
              }}
            >
              <FiTrendingUp className='text-white h-4 w-4' />
            </div>
            <span className='text-base font-bold tracking-tight text-white'>
              FinTrackly
            </span>
            <span
              className='ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest'
              style={{
                background: 'rgba(16,185,129,0.15)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              Beta
            </span>
          </div>

          <motion.button
            onClick={handleGoogleSignIn}
            className='flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white'
            style={{
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.35)',
            }}
            whileHover={
              { scale: 1.04, background: 'rgba(16,185,129,0.25)' } as any
            }
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            Get Started Free
            <FiArrowRight className='h-3.5 w-3.5' />
          </motion.button>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section
        className='relative px-6 pt-36 pb-20 max-w-6xl mx-auto text-center'
        style={{ zIndex: 1 }}
      >
        <motion.div initial='hidden' animate='show' variants={stagger}>
          <motion.div variants={fadeUp}>
            <div
              className='inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold'
              style={{
                background: 'rgba(16,185,129,0.1)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <FiZap className='h-3 w-3' />
              Built for Indian investors · 100% private
            </div>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className='font-black tracking-tighter mb-6'
            style={{
              fontSize: 'clamp(38px, 6.5vw, 78px)',
              lineHeight: 1.06,
              color: '#f8fafc',
            }}
          >
            India's free personal
            <br />
            <span
              style={{
                background:
                  'linear-gradient(135deg, #10b981, #34d399, #6ee7b7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              finance tracker.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className='text-lg max-w-2xl mx-auto mb-10 leading-relaxed'
            style={{ color: 'rgba(226,232,240,0.52)' }}
          >
            Track net worth, stocks, mutual funds, SIPs, crypto, gold, FDs, PPF
            and expenses across 20+ asset classes. Import from Zerodha, Groww,
            Angel One & INDmoney. No broker credentials. No third-party
            tracking. Just you and your data.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className='flex items-center justify-center gap-3 mb-12'
          >
            <motion.button
              onClick={handleGoogleSignIn}
              className='flex items-center gap-3 px-7 py-4 rounded-xl font-bold text-base text-white'
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow:
                  '0 0 36px rgba(16,185,129,0.35), 0 4px 20px rgba(0,0,0,0.35)',
              }}
              whileHover={
                {
                  scale: 1.04,
                  boxShadow:
                    '0 0 54px rgba(16,185,129,0.5), 0 4px 24px rgba(0,0,0,0.4)',
                } as any
              }
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <FcGoogle className='text-xl' />
              Continue with Google
            </motion.button>
          </motion.div>

          {/* Trust pills */}
          <motion.div
            variants={fadeUp}
            className='flex flex-wrap items-center justify-center gap-3 mb-16'
          >
            {[
              '14 Built Modules',
              'Stocks · MFs · SIPs · Crypto · Gold',
              'Import Zerodha · Groww · Angel One',
              'PPF · NPS · FD Tracker',
              'Notion Sync',
              '100% Free & Private',
              'CSV & Excel Export',
              'NSE 500+ Stocks',
            ].map((s, i) => (
              <div
                key={i}
                className='flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium'
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(226,232,240,0.55)',
                }}
              >
                <FiCheck className='text-emerald-400 h-3 w-3 flex-shrink-0' />
                {s}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── DASHBOARD MOCKUP ── */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className='rounded-2xl overflow-hidden mx-auto'
          style={{
            maxWidth: 860,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow:
              '0 32px 72px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Browser chrome */}
          <div
            className='flex items-center gap-2 px-4 py-3'
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <div className='h-3 w-3 rounded-full bg-red-400' />
            <div className='h-3 w-3 rounded-full bg-yellow-400' />
            <div className='h-3 w-3 rounded-full bg-green-400' />
            <div
              className='ml-3 flex-1 max-w-xs rounded-md px-3 py-1 text-xs'
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(226,232,240,0.3)',
              }}
            >
              fintrackly.app/dashboard
            </div>
          </div>

          {/* Stats */}
          <div className='p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left'>
            {[
              {
                label: 'Net Worth',
                value: '₹48.2L',
                change: '+18.2%',
                color: '#10b981',
              },
              {
                label: 'Total Assets',
                value: '₹54.6L',
                change: '67 assets',
                color: '#3b82f6',
              },
              {
                label: 'Liabilities',
                value: '₹6.4L',
                change: '3 loans',
                color: '#f87171',
              },
              {
                label: 'Savings Rate',
                value: '60%',
                change: '↑ 5%',
                color: '#a78bfa',
              },
            ].map((card) => (
              <div
                key={card.label}
                className='rounded-xl p-4'
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <p
                  className='text-xs mb-1'
                  style={{ color: 'rgba(226,232,240,0.4)' }}
                >
                  {card.label}
                </p>
                <p className='text-xl font-bold text-white'>{card.value}</p>
                <p
                  className='text-xs font-semibold mt-1'
                  style={{ color: card.color }}
                >
                  {card.change}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className='px-5 pb-5'>
            <div
              className='rounded-xl p-5'
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className='flex items-center justify-between mb-4'>
                <p
                  className='text-sm font-semibold'
                  style={{ color: 'rgba(226,232,240,0.8)' }}
                >
                  Net Worth Over Time
                </p>
                <span
                  className='text-xs px-2 py-1 rounded-full font-semibold'
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  +18.2% YTD
                </span>
              </div>
              <svg
                width='100%'
                height='64'
                viewBox='0 0 400 64'
                preserveAspectRatio='none'
              >
                <defs>
                  <linearGradient id='cg' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#10b981' stopOpacity='0.3' />
                    <stop offset='100%' stopColor='#10b981' stopOpacity='0' />
                  </linearGradient>
                </defs>
                <path
                  d='M0,52 C40,48 70,44 100,38 C130,32 160,40 200,28 C240,16 270,22 300,14 C330,8 360,10 400,4'
                  fill='none'
                  stroke='#10b981'
                  strokeWidth='2.5'
                />
                <path
                  d='M0,52 C40,48 70,44 100,38 C130,32 160,40 200,28 C240,16 270,22 300,14 C330,8 360,10 400,4 L400,64 L0,64 Z'
                  fill='url(#cg)'
                />
              </svg>
              <div className='flex justify-between mt-2'>
                {['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map(
                  (m) => (
                    <span
                      key={m}
                      className='text-[10px]'
                      style={{ color: 'rgba(226,232,240,0.2)' }}
                    >
                      {m}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        className='px-6 py-20 relative'
        id='how-it-works'
        style={{ zIndex: 1 }}
      >
        <div className='max-w-5xl mx-auto'>
          <motion.div
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className='text-center mb-12'>
              <p
                className='text-xs font-bold uppercase tracking-widest mb-3'
                style={{ color: '#10b981' }}
              >
                Simple as 1-2-3
              </p>
              <h2 className='text-3xl md:text-4xl font-black text-white tracking-tight'>
                Get your net worth in under 5 minutes
              </h2>
            </motion.div>

            <div className='grid md:grid-cols-3 gap-5'>
              {[
                {
                  step: '01',
                  title: 'Sign up in 10 seconds',
                  desc: "One-click Google sign-in. Fill in a quick profile and you're in.",
                  icon: <FcGoogle className='text-2xl' />,
                },
                {
                  step: '02',
                  title: 'Add your assets',
                  desc: 'Enter manually, use CSV/Excel templates, or import directly from Zerodha or Groww.',
                  icon: (
                    <FiUpload
                      style={{ color: '#10b981' }}
                      className='text-xl'
                    />
                  ),
                },
                {
                  step: '03',
                  title: 'See your complete picture',
                  desc: 'Dashboard shows net worth, income vs expenses, allocation breakdown and goal progress.',
                  icon: (
                    <FiBarChart2
                      style={{ color: '#3b82f6' }}
                      className='text-xl'
                    />
                  ),
                },
              ].map((item) => (
                <motion.div
                  key={item.step}
                  variants={fadeUp}
                  className='rounded-2xl p-7'
                  style={glassBase}
                  whileHover={
                    {
                      y: -5,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.13)',
                    } as any
                  }
                  transition={{ duration: 0.2 }}
                >
                  <div className='flex items-center gap-3 mb-5'>
                    <span
                      className='text-xs font-black tracking-widest'
                      style={{ color: 'rgba(255,255,255,0.14)' }}
                    >
                      {item.step}
                    </span>
                    <div
                      className='h-9 w-9 rounded-xl flex items-center justify-center'
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {item.icon}
                    </div>
                  </div>
                  <h3 className='text-sm font-bold text-white mb-2'>
                    {item.title}
                  </h3>
                  <p
                    className='text-sm leading-relaxed'
                    style={{ color: 'rgba(226,232,240,0.48)' }}
                  >
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section
        className='px-6 py-20 max-w-6xl mx-auto relative'
        id='features'
        style={{ zIndex: 1 }}
      >
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className='text-center mb-12'>
            <p
              className='text-xs font-bold uppercase tracking-widest mb-3'
              style={{ color: '#10b981' }}
            >
              Everything you need
            </p>
            <h2 className='text-3xl md:text-4xl font-black text-white tracking-tight'>
              Built for how Indians actually invest
            </h2>
            <p
              className='mt-3 max-w-xl mx-auto text-sm'
              style={{ color: 'rgba(226,232,240,0.42)' }}
            >
              14 fully built modules — track stocks, mutual funds, SIPs, crypto,
              gold, FDs, PPF, NPS, expenses, liabilities and goals. Every
              feature is live and ready to use.
            </p>
          </motion.div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className='p-6 rounded-2xl relative overflow-hidden cursor-default group'
                style={glassBase}
                onHoverStart={() => setHoveredFeature(i)}
                onHoverEnd={() => setHoveredFeature(null)}
                whileHover={
                  {
                    y: -4,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.13)',
                  } as any
                }
                transition={{ duration: 0.2 }}
              >
                {/* Top accent line */}
                <div
                  className='absolute top-0 left-0 right-0 h-px transition-opacity duration-300'
                  style={{
                    background: `linear-gradient(90deg, transparent, ${f.color}, transparent)`,
                    opacity: hoveredFeature === i ? 1 : 0,
                  }}
                />

                <div
                  className='h-10 w-10 rounded-xl flex items-center justify-center text-lg mb-4'
                  style={{
                    background: `${f.glow.replace('0.25', '0.12')}`,
                    border: `1px solid ${f.color}28`,
                    color: f.color,
                  }}
                >
                  {f.icon}
                </div>
                <h3 className='text-sm font-bold text-white mb-2'>{f.label}</h3>
                <p
                  className='text-sm leading-relaxed mb-4'
                  style={{ color: 'rgba(226,232,240,0.44)' }}
                >
                  {f.desc}
                </p>

                {/* Bullet list — visible always on mobile, on hover on desktop */}
                <div
                  className='overflow-hidden transition-all duration-300'
                  style={{
                    maxHeight: hoveredFeature === i ? '200px' : '0px',
                    opacity: hoveredFeature === i ? 1 : 0,
                  }}
                >
                  <div
                    className='pt-3'
                    style={{ borderTop: `1px solid ${f.color}20` }}
                  >
                    {f.bullets.map((b, bi) => (
                      <div key={bi} className='flex items-start gap-2 mb-1.5'>
                        <FiCheck
                          className='mt-0.5 flex-shrink-0 h-3 w-3'
                          style={{ color: f.color }}
                        />
                        <span
                          className='text-xs leading-snug'
                          style={{ color: 'rgba(226,232,240,0.55)' }}
                        >
                          {b}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── FEATURE DEEP DIVE ── */}
      <section
        className='px-6 py-20 relative'
        id='deep-dive'
        style={{ zIndex: 1 }}
      >
        <div className='max-w-5xl mx-auto'>
          <motion.div
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className='text-center mb-12'>
              <p
                className='text-xs font-bold uppercase tracking-widest mb-3'
                style={{ color: '#10b981' }}
              >
                What's inside
              </p>
              <h2 className='text-3xl md:text-4xl font-black text-white tracking-tight'>
                A closer look at every module
              </h2>
              <p
                className='mt-3 max-w-xl mx-auto text-sm'
                style={{ color: 'rgba(226,232,240,0.42)' }}
              >
                Every feature below is fully built and live — not a mockup, not
                a roadmap item.
              </p>
            </motion.div>

            {/* Two-column feature detail rows */}
            {[
              {
                icon: <FiBarChart2 />,
                color: '#10b981',
                label: 'Dashboard',
                tagline: 'Your entire financial life, one scroll away',
                detail:
                  'The dashboard pulls from every other module in real time. Summary cards show net worth, total assets, total liabilities, and cashflow for the current month. Below that, asset allocation donuts and a maturity timeline help you see where your money is sitting. Sector and market-cap charts (powered by bundled NSE data) give equity investors a quick portfolio health check. At the bottom, a goals progress panel and a net worth growth chart using your snapshot history complete the picture.',
                pills: [
                  'Net Worth Cards',
                  'Asset Allocation',
                  'Maturity Timeline',
                  'Sector Charts',
                  'Goals Summary',
                  'Growth Chart',
                ],
              },
              {
                icon: <FiBriefcase />,
                color: '#a78bfa',
                label: 'Investments',
                tagline: 'Every asset class, one table',
                detail:
                  "The investments module handles Stocks, Mutual Funds, Bonds, Fixed Deposits, Gold, Silver, Crypto, PPF, NPS, and any 'Other' asset. You can add holdings manually via a detailed modal form, or import them from four platforms: Zerodha (CSV), Angel One (PDF), Groww (CSV), and INDmoney (XLSX). The table supports live search by name, symbol, or platform, and filtering by asset type. Each row shows invested amount, current value, and profit/loss.",
                pills: [
                  'Stocks & MFs',
                  'Bonds & FDs',
                  'Gold, Silver, Crypto, PPF, NPS',
                  'Import 4 Platforms',
                  'Search & Filter',
                  'P&L Per Row',
                ],
              },
              {
                icon: <FiActivity />,
                color: '#3b82f6',
                label: 'Cashflow',
                tagline: 'Monthly income and expense tracking, simplified',
                detail:
                  "A month picker lets you navigate up to 12 months of history. For each month, summary metric cards calculate your total income, total expenses, and savings rate automatically. Below that, every transaction is listed in a clean table with date, category, description, and amount. You can add, edit, or delete any entry at any time using a smooth modal form. Cashflow data also feeds the 'income vs expense' cards on the dashboard.",
                pills: [
                  '12-Month History',
                  'Income & Expense Metrics',
                  'Savings Rate',
                  'Add / Edit / Delete',
                  'Monthly Drill-down',
                ],
              },
              {
                icon: <FiFlag />,
                color: '#ec4899',
                label: 'Goals',
                tagline: 'Track your milestones with visual progress bars',
                detail:
                  "Create any financial goal with a name, target amount, current amount saved, and an optional due date. The goals table renders a progress bar for each goal, auto-calculated from current vs target. Goals that reach 100% show a 'Completed' state. You can create as many goals as needed — retirement corpus, house down payment, emergency fund, education fund, or anything custom. The dashboard also shows a goals summary panel at a glance.",
                pills: [
                  'Name & Target Amount',
                  'Progress Bar',
                  'Due Date',
                  'Completed State',
                  'Dashboard Summary Panel',
                ],
              },
              {
                icon: <FiCreditCard />,
                color: '#f87171',
                label: 'Liabilities',
                tagline: 'See exactly what you owe, all in one place',
                detail:
                  'The liabilities page tracks all outstanding debts: home loans, car loans, personal loans, credit cards, and custom types. Each entry stores the liability name, type, outstanding amount, and interest rate. A hero summary card at the top shows your total outstanding debt in bold. The table supports add, edit, and delete. Liabilities flow into your net worth calculation on the Dashboard automatically.',
                pills: [
                  'Loans & Credit Cards',
                  'Outstanding Amount',
                  'Interest Rate',
                  'Total Debt Summary',
                  'Net Worth Integration',
                ],
              },
              {
                icon: <FiCamera />,
                color: '#fb923c',
                label: 'Snapshots',
                tagline: 'Freeze your net worth. Build your wealth history.',
                detail:
                  "Snapshots capture your portfolio state at any moment. Enter an optional label (like 'Jan 2026 Start') and click — the app records your total assets, total liabilities, and computed net worth from live data. All snapshots are stored chronologically in a table. The Dashboard's growth chart reads from this snapshot history to render your net worth curve over time. There's no limit to how many snapshots you can take.",
                pills: [
                  'Instant Snapshot',
                  'Custom Labels',
                  'Assets + Liabilities + Net Worth',
                  'Snapshot History Table',
                  'Feeds Growth Chart',
                ],
              },
              {
                icon: <FiFileText />,
                color: '#22d3ee',
                label: 'Reports',
                tagline: 'Summarise, analyse, and export your portfolio',
                detail:
                  'The reports page gives you four panels: a Portfolio Summary showing total invested, current value, and net P&L; a Data Exports panel to download your entire investment dataset as CSV or Excel; an Asset Allocation table grouped by investment type; and an Interest Earnings panel showing expected returns from your bonds and fixed deposits. Exports include computed P&L columns, not just raw input data.',
                pills: [
                  'Portfolio Summary',
                  'CSV & Excel Export',
                  'Asset Allocation Table',
                  'Interest Earnings',
                  'P&L Computed',
                ],
              },
              {
                icon: <FiSettings />,
                color: '#94a3b8',
                label: 'Settings',
                tagline: 'Manage data, safety net, and integrations',
                detail:
                  'Settings has three panels: Notion Integration (enter your Notion API token and database ID to enable sync), Essentials & Safety Net (record your term insurance cover, health cover, emergency fund target and current amount — shown on the Dashboard), and Data Management (export a full JSON backup of all your data, restore from a backup, or wipe all data if needed).',
                pills: [
                  'Notion API Config',
                  'Term & Health Insurance Tracking',
                  'Emergency Fund Tracker',
                  'JSON Backup & Restore',
                  'Full Data Wipe',
                ],
              },
              {
                icon: <BsBank2 />,
                color: '#06b6d4',
                label: 'Accounts',
                tagline: 'All your bank accounts and cards, one clear view',
                detail:
                  'The Accounts module lets you track every bank account and credit card balance in one place. A summary card shows your total liquid balance at a glance. Below that, a donut chart visualises how your money is distributed across accounts, and a bar chart compares balances side by side. You can add, edit, or delete accounts anytime using a simple modal form that supports both bank and credit card types.',
                pills: [
                  'Bank & Credit Card accounts',
                  'Total liquid balance card',
                  'Donut chart breakdown',
                  'Bar chart comparison',
                  'Add / Edit / Delete',
                ],
              },
              {
                icon: <GiWheat />,
                color: '#84cc16',
                label: 'Agriculture',
                tagline: 'Full farm management for Indian farmers',
                detail:
                  'Agriculture is a standalone module built for farmers who want to track their land alongside their finances. The Overview tab shows season-wise income, expenses, and net profit. The Crops tab tracks individual crop cycles with sowing date, harvest date, yield, and P&L per season. The Expenses tab logs farm costs across 12 categories including seeds, fertilizer, labor, and tractor fuel. Livestock registers animals with an events log (vaccination, purchase, sale). Milk tab records daily production and sales. Coconut tab tracks harvest batches and selling price.',
                pills: [
                  'Overview: P&L by season',
                  'Crop cycles with yield & profit',
                  'Farm expenses (12 categories)',
                  'Livestock register & events',
                  'Daily milk records',
                  'Coconut harvest tracker',
                ],
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                className='mb-6 rounded-2xl overflow-hidden'
                style={glassBase}
              >
                <div
                  className='flex items-center gap-4 px-6 py-5'
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className='h-10 w-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0'
                    style={{
                      background: `${item.color}18`,
                      border: `1px solid ${item.color}28`,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className='flex items-center gap-3 flex-wrap'>
                      <h3 className='text-base font-black text-white'>
                        {item.label}
                      </h3>
                      <span
                        className='text-xs font-semibold px-2 py-0.5 rounded-full'
                        style={{
                          background: `${item.color}18`,
                          color: item.color,
                          border: `1px solid ${item.color}28`,
                        }}
                      >
                        Live ✓
                      </span>
                    </div>
                    <p
                      className='text-xs mt-0.5'
                      style={{ color: 'rgba(226,232,240,0.45)' }}
                    >
                      {item.tagline}
                    </p>
                  </div>
                </div>
                <div className='px-6 py-5'>
                  <p
                    className='text-sm leading-relaxed mb-5'
                    style={{ color: 'rgba(226,232,240,0.55)' }}
                  >
                    {item.detail}
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {item.pills.map((pill, pi) => (
                      <span
                        key={pi}
                        className='text-xs px-3 py-1 rounded-full font-semibold'
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(226,232,240,0.6)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── NOTION SYNC ── */}
      <section
        className='px-6 py-20 max-w-5xl mx-auto relative'
        style={{ zIndex: 1 }}
      >
        <div className='grid md:grid-cols-2 gap-12 items-center'>
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className='h-12 w-12 rounded-2xl flex items-center justify-center mb-6'
              style={glassBase}
            >
              <SiNotion className='text-white text-xl' />
            </div>
            <h2 className='text-3xl font-black text-white tracking-tight mb-4'>
              Notion Ecosystem Integration
            </h2>
            <p
              className='leading-relaxed mb-7 text-sm'
              style={{ color: 'rgba(226,232,240,0.48)' }}
            >
              Keep your entire financial system inside Notion. FinTrackly's
              serverless workers push live data to your workspace so Notion
              remains your single source of truth.
            </p>
            <div className='space-y-3'>
              {[
                'Connect via Notion API token & database ID in Settings',
                'Push investment holdings to a Notion database table',
                'Sync cashflow and monthly expense summaries',
                'Goal progress and snapshot data sync support',
                'Serverless sync powered by Netlify functions',
              ].map((item, i) => (
                <div
                  key={i}
                  className='flex items-center gap-3 text-sm'
                  style={{ color: 'rgba(226,232,240,0.62)' }}
                >
                  <div
                    className='h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0'
                    style={{
                      background: 'rgba(16,185,129,0.14)',
                      border: '1px solid rgba(16,185,129,0.28)',
                    }}
                  >
                    <FiCheck className='text-emerald-400 text-xs' />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className='rounded-2xl overflow-hidden' style={glassBase}>
              <div
                className='flex items-center justify-between px-5 py-4'
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className='text-sm font-semibold text-white'>
                  Notion Sync Status
                </span>
                <div
                  className='flex items-center gap-1.5 text-xs font-semibold'
                  style={{ color: '#10b981' }}
                >
                  <div
                    className='h-2 w-2 rounded-full bg-emerald-400'
                    style={{ boxShadow: '0 0 6px #10b981' }}
                  />
                  LIVE
                </div>
              </div>
              {[
                {
                  db: '📊 Investments',
                  rows: '142 holdings',
                  time: '2 min ago',
                },
                { db: '💸 Expenses', rows: '38 this month', time: '5 min ago' },
                { db: '🎯 Goals', rows: '4 active goals', time: '1 hr ago' },
                { db: '📸 Snapshots', rows: '12 snapshots', time: 'Yesterday' },
              ].map((row, i) => (
                <div
                  key={i}
                  className='flex items-center justify-between px-5 py-4'
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div>
                    <div className='text-sm font-medium text-white'>
                      {row.db}
                    </div>
                    <div
                      className='text-xs mt-0.5'
                      style={{ color: 'rgba(226,232,240,0.35)' }}
                    >
                      {row.rows}
                    </div>
                  </div>
                  <div className='text-right'>
                    <div
                      className='text-xs font-medium'
                      style={{ color: '#10b981' }}
                    >
                      ✓ synced
                    </div>
                    <div
                      className='text-xs mt-0.5'
                      style={{ color: 'rgba(226,232,240,0.25)' }}
                    >
                      {row.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section
        className='px-6 py-20 max-w-5xl mx-auto relative'
        id='privacy'
        style={{ zIndex: 1 }}
      >
        <motion.div
          initial='hidden'
          whileInView='show'
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className='text-center mb-12'>
            <p
              className='text-xs font-bold uppercase tracking-widest mb-3'
              style={{ color: '#10b981' }}
            >
              Your data, your rules
            </p>
            <h2 className='text-3xl md:text-4xl font-black text-white tracking-tight'>
              Privacy is not a feature.
              <br />
              It's the foundation.
            </h2>
          </motion.div>

          <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            {[
              {
                icon: <FiShield />,
                title: 'No Broker Access',
                desc: 'We never connect to your brokerage or bank accounts. You control what gets entered.',
                color: '#10b981',
              },
              {
                icon: <FiLock />,
                title: 'No Data Selling',
                desc: "Your financial data is yours alone. We don't sell, share, or monetize it. Ever.",
                color: '#3b82f6',
              },
              {
                icon: <FiDownload />,
                title: 'Full Data Export',
                desc: 'Export all your data as CSV or JSON anytime. Your data is always accessible.',
                color: '#a78bfa',
              },
              {
                icon: <FiAlertCircle />,
                title: 'Delete Any Time',
                desc: 'One click deletes your entire account and all data. No retention, no dark patterns.',
                color: '#f87171',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className='p-6 rounded-2xl'
                style={glassBase}
                whileHover={
                  {
                    y: -4,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.13)',
                  } as any
                }
                transition={{ duration: 0.2 }}
              >
                <div
                  className='h-10 w-10 rounded-xl flex items-center justify-center text-lg mb-4'
                  style={{
                    background: `${item.color}18`,
                    border: `1px solid ${item.color}28`,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
                <h3 className='text-sm font-bold text-white mb-2'>
                  {item.title}
                </h3>
                <p
                  className='text-sm leading-relaxed'
                  style={{ color: 'rgba(226,232,240,0.44)' }}
                >
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className='px-6 py-20 relative' style={{ zIndex: 1 }}>
        <motion.div
          className='max-w-3xl mx-auto text-center rounded-3xl p-12 relative overflow-hidden'
          style={glassBase}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div
            className='absolute inset-0 pointer-events-none'
            style={{
              background:
                'radial-gradient(ellipse 65% 45% at 50% 0%, rgba(16,185,129,0.1), transparent)',
            }}
          />
          <div className='relative'>
            <h2 className='text-3xl md:text-4xl font-black text-white tracking-tight mb-4'>
              Ready to see your true net worth?
            </h2>
            <p
              className='mb-10 text-lg'
              style={{ color: 'rgba(226,232,240,0.48)' }}
            >
              Join Indian investors who track stocks, mutual funds, SIPs,
              crypto, gold, FDs, PPF and expenses on Fintrackly — free, forever.
            </p>
            <motion.button
              onClick={handleGoogleSignIn}
              className='inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base text-white'
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow:
                  '0 0 40px rgba(16,185,129,0.38), 0 6px 28px rgba(0,0,0,0.38)',
              }}
              whileHover={
                {
                  scale: 1.05,
                  boxShadow:
                    '0 0 60px rgba(16,185,129,0.55), 0 6px 32px rgba(0,0,0,0.42)',
                } as any
              }
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <FcGoogle className='text-xl' />
              Start Free with Google
              <FiArrowRight />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── SEO KEYWORD SECTION — visible, indexable, styled subtly ── */}
      <section
        className='px-6 py-16 relative'
        style={{ zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className='max-w-5xl mx-auto text-center'>
          <p
            className='text-xs font-bold uppercase tracking-widest mb-6'
            style={{ color: 'rgba(16,185,129,0.5)' }}
          >
            What you can track with Fintrackly
          </p>
          <div className='flex flex-wrap justify-center gap-2'>
            {[
              'Net Worth Tracker',
              'Stock Portfolio Tracker',
              'Mutual Fund Tracker',
              'SIP Tracker',
              'Expense Tracker',
              'Crypto Portfolio Tracker',
              'Gold & Silver Tracker',
              'Fixed Deposit Tracker',
              'PPF Tracker',
              'NPS Tracker',
              'Financial Goal Tracker',
              'Investment Portfolio Manager',
              'Zerodha Import',
              'Groww Import',
              'Angel One Import',
              'INDmoney Import',
              'Loan Tracker',
              'Bank Account Tracker',
              'Notion Finance Sync',
              'NSE Stock Data India',
              'Free Finance App India',
              'Personal Finance Dashboard',
            ].map((tag, i) => (
              <span
                key={i}
                className='px-3 py-1.5 rounded-full text-xs'
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(226,232,240,0.3)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className='py-10 px-6 text-center relative'
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 1 }}
      >
        <div className='flex items-center justify-center gap-2 mb-3'>
          <div
            className='h-6 w-6 rounded-md flex items-center justify-center'
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 0 10px rgba(16,185,129,0.4)',
            }}
          >
            <FiTrendingUp className='text-white h-3.5 w-3.5' />
          </div>
          <span
            className='text-sm font-bold'
            style={{ color: 'rgba(226,232,240,0.65)' }}
          >
            FinTrackly
          </span>
        </div>
        <p className='text-xs' style={{ color: 'rgba(226,232,240,0.2)' }}>
          © 2026 Fintrackly · Free personal finance tracker & investment
          portfolio manager for India
        </p>
      </footer>
    </div>
  );
}
