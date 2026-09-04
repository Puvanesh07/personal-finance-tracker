// src/Auth/AuthPage.tsx
//
// FIXES:
//  1. Added success toast on Google sign-in
//  2. Added error toast with user-friendly message on sign-in failure
//  3. Removed PWAInstallBanner from here — it belongs in AppLayout (dashboard)
//     so authenticated users see it, not unauthenticated visitors on every load
//  4. Added loading state on sign-in button to prevent double-clicks

import { motion, type Variants } from 'framer-motion';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  googleSignInErrorMessage,
  signInWithGoogle,
} from './googleSignIn';
import RegisterPage from './RegisterPage';
import LoginPage from './LoginPage';
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
  FiDatabase,
  FiGlobe,
  FiLoader,
  FiMail,
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { SiNotion } from 'react-icons/si';
import { BsBank2 } from 'react-icons/bs';

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
    desc: 'Connect your Notion workspace via API token and database ID. Push investment data, expenses, goals and snapshots directly into your Notion databases.',
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
    desc: 'Built-in NSE stock metadata with sector and market-cap classification for 500+ Indian equities. Powers the sector allocation and market-cap charts automatically.',
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
    desc: 'Track all your bank accounts and credit cards in one place. See total liquid balance, account-wise breakdown with a donut chart, and a bar chart comparing balances.',
    bullets: [
      'Add bank accounts & credit cards',
      'Per-account balance tracking',
      'Total liquid balance summary card',
      'Donut & bar chart breakdown',
      'Add, edit & delete accounts anytime',
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
  const [signingIn, setSigningIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleGoogleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      const method = await signInWithGoogle();
      if (method === 'popup') {
        toast.success('Welcome to FinTrackly! 🎉', {
          duration: 3000,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(16,185,129,0.4)',
          },
          iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
        });
      }
    } catch (error: unknown) {
      const message = googleSignInErrorMessage(error);
      if (message) {
        toast.error(message, {
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(248,113,113,0.4)',
          },
        });
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <>
      {showRegister && (
        <RegisterPage
          onBack={() => setShowRegister(false)}
          onSwitchToLogin={() => {
            setShowRegister(false);
            setShowLogin(true);
          }}
        />
      )}
      {showLogin && (
        <LoginPage
          onBack={() => setShowLogin(false)}
          onSwitchToRegister={() => {
            setShowLogin(false);
            setShowRegister(true);
          }}
        />
      )}
      {!showRegister && !showLogin && (
        <div
          className='min-h-screen overflow-x-hidden'
          style={{
            background: '#020b18',
            color: '#e2e8f0',
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {/* ── STATIC BG — pure CSS, zero JS cost ── */}
          <div
            className='fixed inset-0 pointer-events-none'
            style={{ zIndex: 0 }}
          >
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
              </div>

              <motion.button
                onClick={() => setShowRegister(true)}
                className='flex cursor-pointer items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white'
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
                Get Started
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
                  className='inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold'
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
                Your complete personal
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
                  finance dashboard.
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className='text-lg max-w-2xl mx-auto mb-10 leading-relaxed'
                style={{ color: 'rgba(226,232,240,0.52)' }}
              >
                Track net worth, stocks, mutual funds, SIPs, crypto, gold, FDs,
                PPF, NPS, insurance, and expenses across 20+ asset classes.
                Import from Zerodha, Groww, Angel One &amp; INDmoney. No broker
                credentials required. Your data stays private and encrypted.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className='flex flex-wrap items-center justify-center gap-3 mb-12'
              >
                <motion.button
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  className='flex cursor-pointer items-center gap-3 px-7 py-4 rounded-xl font-bold text-base text-white disabled:opacity-60'
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
                  {signingIn ? (
                    <>
                      <FiLoader className='text-xl animate-spin' />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <FcGoogle className='text-xl' />
                      Continue with Google
                    </>
                  )}
                </motion.button>

                <motion.button
                  onClick={() => setShowRegister(true)}
                  className='flex cursor-pointer items-center gap-3 px-7 py-4 rounded-xl font-bold text-base text-white'
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(10px)',
                  }}
                  whileHover={
                    {
                      scale: 1.04,
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                    } as any
                  }
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <FiMail className='text-xl' style={{ color: '#60a5fa' }} />
                  Sign up with Email
                </motion.button>
              </motion.div>

              {/* Already have account */}
              <motion.div variants={fadeUp} className='mb-4'>
                <p
                  className='text-sm cursor-pointer'
                  style={{ color: 'rgba(226,232,240,0.38)' }}
                >
                  Already have an account?{' '}
                  <button
                    onClick={() => setShowLogin(true)}
                    style={{
                      color: '#10b981',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      pointerEvents: 'auto',
                      fontSize: 14,
                    }}
                  >
                    Sign in with email →
                  </button>
                </p>
              </motion.div>

              {/* Trust pills */}
              <motion.div
                variants={fadeUp}
                className='flex flex-wrap items-center justify-center gap-3 mb-16'
              >
                {[
                  '20+ Asset Classes',
                  'Stocks · MFs · SIPs · Crypto · Gold',
                  'Import Zerodha · Groww · Angel One',
                  'PPF · NPS · FD · Insurance Tracker',
                  'AI Financial Coach',
                  'Private & Secure',
                  'CSV & Excel Export',
                  'NSE 500+ Stocks',
                ].map((s, i) => (
                  <div
                    key={i}
                    className='flex cursor-pointer items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium'
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
              transition={{
                delay: 0.4,
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
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
                className='flex cursor-pointer items-center gap-2 px-4 py-3'
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                <div className='h-3 w-3 rounded-full bg-red-400' />
                <div className='h-3 w-3 rounded-full bg-yellow-400' />
                <div className='h-3 w-3 rounded-full bg-green-400' />
                <div
                  className='ml-3 flex-1 max-w-xs rounded-md px-3 py-1 text-xs cursor-pointer'
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(226,232,240,0.3)',
                  }}
                >
                  fintrackly.app/dashboard
                </div>
              </div>

              {/* Stats */}
              <div className='p-5 grid cursor-pointer grid-cols-2 sm:grid-cols-4 gap-4 text-left'>
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
                    className='rounded-xl p-4 cursor-pointer'
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <p
                      className='text-xs mb-1 cursor-pointer'
                      style={{ color: 'rgba(226,232,240,0.4)' }}
                    >
                      {card.label}
                    </p>
                    <p className='text-xl font-bold text-white'>{card.value}</p>
                    <p
                      className='text-xs font-semibold mt-1 cursor-pointer'
                      style={{ color: card.color }}
                    >
                      {card.change}
                    </p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className='px-5 pb-5 cursor-pointer'>
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
                        <stop
                          offset='0%'
                          stopColor='#10b981'
                          stopOpacity='0.3'
                        />
                        <stop
                          offset='100%'
                          stopColor='#10b981'
                          stopOpacity='0'
                        />
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
                    {[
                      'Jul',
                      'Aug',
                      'Sep',
                      'Oct',
                      'Nov',
                      'Dec',
                      'Jan',
                      'Feb',
                    ].map((m) => (
                      <span
                        key={m}
                        className='text-[11px] font-medium'
                        style={{ color: 'rgba(148,163,184,0.85)' }}
                      >
                        {m}
                      </span>
                    ))}
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
                  14 fully built modules — track stocks, mutual funds, SIPs,
                  crypto, gold, FDs, PPF, NPS, expenses, liabilities and goals.
                  Every feature is live and ready to use.
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
                    <h3 className='text-sm font-bold text-white mb-2'>
                      {f.label}
                    </h3>
                    <p
                      className='text-sm leading-relaxed mb-4'
                      style={{ color: 'rgba(226,232,240,0.44)' }}
                    >
                      {f.desc}
                    </p>

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
                          <div
                            key={bi}
                            className='flex items-start gap-2 mb-1.5'
                          >
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
                  crypto, gold, FDs, PPF and expenses on Fintrackly
                </p>
                <div className='flex flex-wrap items-center justify-center gap-3'>
                  <motion.button
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                    className='inline-flex items-center cursor-pointer gap-3 px-8 py-4 rounded-xl font-bold text-base text-white disabled:opacity-60'
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
                    {signingIn ? (
                      <>
                        <FiLoader className='text-xl animate-spin' />
                        Signing in…
                      </>
                    ) : (
                      <>
                        <FcGoogle className='text-xl' />
                        Continue with Google
                        <FiArrowRight />
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    onClick={() => setShowRegister(true)}
                    className='inline-flex items-center cursor-pointer gap-3 px-8 py-4 rounded-xl font-bold text-base text-white'
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                    whileHover={
                      {
                        scale: 1.04,
                        background: 'rgba(255,255,255,0.12)',
                      } as any
                    }
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                  >
                    <FiMail className='text-xl' style={{ color: '#60a5fa' }} />
                    Sign up with Email
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── SEO KEYWORD SECTION ── */}
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
                  'Budget Management',
                  'Personal Finance Dashboard',
                ].map((tag, i) => (
                  <span
                    key={i}
                    className='px-3 py-1.5 rounded-full text-xs cursor-pointer'
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
            className='py-10 px-6 text-center relative cursor-pointer'
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
            <p
              className='text-xs cursor-pointer'
              style={{ color: 'rgba(148,163,184,0.85)' }}
            >
              © 2026 Fintrackly · Personal finance tracker &amp; investment
              portfolio manager for India
            </p>
          </footer>

          {/* ── PWA BANNER IS INTENTIONALLY NOT HERE ──
           It now lives in AppLayout so only authenticated users see it
           once per install prompt. This prevents it spamming unauthenticated visitors. */}
        </div>
      )}
    </>
  );
}
