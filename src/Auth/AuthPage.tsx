// src/Auth/AuthPage.tsx
//
// Public marketing landing page shown to logged-out visitors.
// Theme: light "lavender" — soft violet gradients on a near-white canvas.
// The sign-in / register overlays are rendered by LoginPage & RegisterPage.

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
  FiLock,
  FiDownload,
  FiBarChart2,
  FiShield,
  FiCheck,
  FiArrowRight,
  FiUpload,
  FiPackage,
  FiCreditCard,
  FiBriefcase,
  FiZap,
  FiActivity,
  FiFlag,
  FiDatabase,
  FiLoader,
  FiMail,
  FiCalendar,
  FiCpu,
  FiRepeat,
  FiUsers,
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { SiNotion } from 'react-icons/si';
import { BsBank2 } from 'react-icons/bs';

// ── Theme tokens ────────────────────────────────────────────────────────────
const VIOLET = '#7c3aed';
const VIOLET_DEEP = '#6d28d9';
const INK = '#241a3d';
const BODY = '#5b4b7f';
const MUTED = '#8a7bad';

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
type Feature = {
  icon: React.ReactNode;
  color: string;
  glow: string;
  label: string;
  desc: string;
  bullets: string[];
};

const features: Feature[] = [
  {
    icon: <FiBarChart2 />,
    color: VIOLET,
    glow: 'rgba(124,58,237,0.14)',
    label: 'Unified Dashboard',
    desc: 'One private overview of your whole financial life — net worth, asset allocation, maturity timeline, sector & market-cap splits, goal progress and a full wealth-growth chart.',
    bullets: [
      'Net worth, assets & liabilities summary cards',
      'Allocation, maturity & sector charts',
      'Goal progress at a glance',
      'Net worth growth across snapshots',
      'Recurring-synced, always up to date',
    ],
  },
  {
    icon: <FiBriefcase />,
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.14)',
    label: 'Investments & Loans',
    desc: 'Manage Stocks, Mutual Funds, Bonds, FDs, Gold, Silver, Crypto, PPF and NPS in one place. Filter by type, search by symbol, and see invested vs current value with live P&L.',
    bullets: [
      'Stocks, MFs, Bonds, FDs, Gold, Silver, Crypto, PPF, NPS',
      'Invested vs current with P&L per holding',
      'Import from Zerodha, Angel One, Groww, INDmoney',
      'Goal-linked holdings auto-track progress',
      'Rich add / edit / delete forms',
    ],
  },
  {
    icon: <FiActivity />,
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.14)',
    label: 'Smart Cashflow',
    desc: 'Log income and expenses against any account — the account balance updates automatically the moment you save, with a running savings-rate and a rolling month picker.',
    bullets: [
      'Expense / income instantly re-syncs account balance',
      'Income, expense & savings-rate metrics',
      'Month-by-month transaction table',
      'Categorised income / expense entries',
      'Transfer flows between accounts',
    ],
  },
  {
    icon: <FiRepeat />,
    color: VIOLET_DEEP,
    glow: 'rgba(109,40,217,0.14)',
    label: 'Bond Interest Auto-Sync',
    desc: 'Set a coupon schedule once and Fintrackly generates every interest entry for you. Mark it synced and the cash lands in your account — with a clear confirmation before anything changes.',
    bullets: [
      'Auto-generated coupon schedule',
      'Deterministic, duplicate-safe entries',
      'Interest credited to linked account on sync',
      'Maturity archives the bond & moves principal to cash',
      'Net-worth neutral — no double counting',
    ],
  },
  {
    icon: <FiCalendar />,
    color: '#9333ea',
    glow: 'rgba(147,51,234,0.14)',
    label: 'Upcoming Bills & Reminders',
    desc: 'Never miss an EMI, SIP or bill. Mark a payment paid and the linked ledger updates — but only after you approve a plain-language summary of what will change.',
    bullets: [
      'Recurring bill & EMI tracker',
      'Mark-paid with a Yes/No sync confirmation',
      'Insurance-linked bills settle automatically',
      'Nothing changes unless you approve',
      'Renewal reminders push to your device',
    ],
  },
  {
    icon: <FiUsers />,
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.14)',
    label: 'Receivables & Lending',
    desc: 'Track money you are owed. Mark a payment received and it becomes income that lifts your net worth — again gated behind a confirmation you control.',
    bullets: [
      'Person-wise receivable ledger',
      'Principal & interest split',
      'Mark-received creates the inflow cashflow',
      'Raises net worth on confirmation',
      'Duplicate-safe, one entry per receipt',
    ],
  },
  {
    icon: <FiCreditCard />,
    color: '#c026d3',
    glow: 'rgba(192,38,211,0.14)',
    label: 'Liabilities',
    desc: 'Log home loans, car loans, credit cards and personal debt. Outstanding balances, interest rates and total debt roll up into your net-worth maths automatically.',
    bullets: [
      'Home, car, personal loans & credit cards',
      'Outstanding amount & interest rate',
      'Total outstanding debt card',
      'Payment records auto-link to cashflow',
      'Custom liability types supported',
    ],
  },
  {
    icon: <FiFlag />,
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.14)',
    label: 'Goals',
    desc: 'Set a target, a due date and link the investments that fund it. Progress uses live market value — no more stale manual totals.',
    bullets: [
      'Target amount, due date & progress bar',
      'Goal-linked investments update value live',
      'Contribution flows stay in sync',
      'Retirement, home, education & custom goals',
      'Editable anytime',
    ],
  },
  {
    icon: <FiCpu />,
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.14)',
    label: 'AI Financial Coach',
    desc: 'Ask questions about your own data and get grounded, private analysis — portfolio health, spending habits and next best actions, without your numbers ever leaving your account.',
    bullets: [
      'Context-aware answers from your portfolio',
      'Anomaly & habit detection',
      'Actionable, plain-language guidance',
      'Private — data stays scoped to you',
      'One-tap actions you confirm',
    ],
  },
  {
    icon: <FiPackage />,
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.14)',
    label: 'Import / Export',
    desc: 'Bring your holdings in from four major Indian platforms with no broker access, and export everything as CSV, Excel or a full JSON backup whenever you like.',
    bullets: [
      'Zerodha (CSV) & Groww (CSV) import',
      'Angel One (PDF) & INDmoney (XLSX) import',
      'Export as CSV or Excel (.xlsx)',
      'Full JSON backup & restore',
      'Your data is always portable',
    ],
  },
  {
    icon: <BsBank2 />,
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.14)',
    label: 'Accounts & Snapshots',
    desc: 'Every bank account and card in one view with total liquid balance, plus one-click snapshots that freeze your net worth so you can watch it grow over time.',
    bullets: [
      'Bank accounts & credit cards',
      'Per-account balance + donut split',
      'Total liquid balance summary',
      'One-click net worth snapshots',
      'Foundation for the growth chart',
    ],
  },
  {
    icon: <SiNotion />,
    color: '#4f46e5',
    glow: 'rgba(79,70,229,0.14)',
    label: 'Notion Sync',
    desc: 'Connect a Notion workspace and push investments, expenses, goals and snapshots straight into your own databases — serverless and on your terms.',
    bullets: [
      'Connect via Notion token & database ID',
      'Push investments to Notion',
      'Sync monthly expense summaries',
      'Goal & snapshot sync',
      'Serverless via edge functions',
    ],
  },
  {
    icon: <FiLock />,
    color: '#6d28d9',
    glow: 'rgba(109,40,217,0.14)',
    label: 'Credentials Vault',
    desc: 'Keep sensitive financial logins and document references organised in an encrypted vault, scoped to your account and never sold or shared.',
    bullets: [
      'Encrypted credential storage',
      'Scoped to your Google account',
      'Quick lookup when you need it',
      'No third-party access',
      'Part of your private workspace',
    ],
  },
  {
    icon: <FiDatabase />,
    color: '#9333ea',
    glow: 'rgba(147,51,234,0.14)',
    label: 'Data Control & Safety',
    desc: 'Total ownership — back up everything as JSON, restore in a click, and erase your entire account with a single tamper-proof, server-enforced deletion.',
    bullets: [
      'Full JSON backup & restore',
      'Server-side account deletion (GDPR)',
      'Recent-login gate + confirm token',
      'Cross-collection wipe — nothing left behind',
      'Firebase Firestore cloud store',
    ],
  },
];

const trustPills = [
  '20+ Asset Classes',
  'Stocks · MFs · SIPs · Crypto · Gold',
  'Import Zerodha · Groww · Angel One',
  'Bond & Bill Auto-Sync',
  'Receivables Tracker',
  'AI Financial Coach',
  'Goal-Linked Investments',
  'Private & Encrypted',
];

const keywordTags = [
  'Net Worth Tracker',
  'Stock Portfolio Tracker India',
  'Mutual Fund Tracker',
  'SIP Tracker',
  'Bond Interest Tracker',
  'Expense & Income Tracker',
  'Crypto Portfolio Tracker',
  'Gold & Silver Tracker',
  'Fixed Deposit Tracker',
  'PPF Tracker',
  'NPS Tracker',
  'Financial Goal Tracker',
  'Payment Bill Reminders',
  'Receivables / Lending Tracker',
  'Zerodha Import',
  'Groww Import',
  'Angel One Import',
  'INDmoney Import',
  'Loan & Liability Tracker',
  'Bank Account Tracker',
  'AI Financial Coach',
  'Notion Finance Sync',
  'NSE Stock Data India',
  'Personal Finance Dashboard',
];

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid rgba(124,58,237,0.14)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 18px 44px rgba(109,40,217,0.10)',
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
            background: INK,
            color: '#ffffff',
            border: '1px solid rgba(124,58,237,0.4)',
          },
          iconTheme: { primary: VIOLET, secondary: '#ffffff' },
        });
      }
    } catch (error: unknown) {
      const message = googleSignInErrorMessage(error);
      if (message) {
        toast.error(message, {
          duration: 4000,
          style: {
            background: INK,
            color: '#ffffff',
            border: '1px solid rgba(190,24,93,0.35)',
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
            background:
              'linear-gradient(180deg, #faf7ff 0%, #f4edff 45%, #ece1ff 100%)',
            color: INK,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
          }}
        >
          {/* ── STATIC BG — lavender glows ── */}
          <div className='fixed inset-0 pointer-events-none' style={{ zIndex: 0 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(124,58,237,0.14) 0%, transparent 60%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse 55% 40% at 95% 80%, rgba(168,85,247,0.10) 0%, transparent 55%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse 45% 35% at 0% 55%, rgba(99,102,241,0.09) 0%, transparent 55%)',
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
              background: 'rgba(250,247,255,0.82)',
              backdropFilter: 'blur(18px)',
              borderBottom: '1px solid rgba(124,58,237,0.12)',
            }}
          >
            <div className='flex items-center justify-between px-6 py-4 max-w-6xl mx-auto'>
              <div className='flex items-center gap-2.5'>
                <div
                  className='h-8 w-8 rounded-lg flex items-center justify-center'
                  style={{
                    background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                    boxShadow: '0 6px 18px rgba(124,58,237,0.35)',
                  }}
                >
                  <FiTrendingUp className='text-white h-4 w-4' />
                </div>
                <span
                  className='text-base font-bold tracking-tight'
                  style={{ color: INK }}
                >
                  Fin<span style={{ color: VIOLET }}>Trackly</span>
                </span>
              </div>

              <div className='flex items-center gap-2 sm:gap-4'>
                <a
                  href='#features'
                  className='hidden sm:inline text-sm font-semibold'
                  style={{ color: BODY }}
                >
                  Features
                </a>
                <a
                  href='#how-it-works'
                  className='hidden sm:inline text-sm font-semibold'
                  style={{ color: BODY }}
                >
                  How it works
                </a>
                <button
                  onClick={() => setShowLogin(true)}
                  className='text-sm font-semibold cursor-pointer'
                  style={{ color: VIOLET, background: 'none', border: 'none' }}
                >
                  Sign in
                </button>
                <motion.button
                  onClick={() => setShowRegister(true)}
                  className='flex cursor-pointer items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white'
                  style={{
                    background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                    boxShadow: '0 8px 20px rgba(124,58,237,0.3)',
                    border: 'none',
                  }}
                  whileHover={{ scale: 1.04 } as any}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  Get Started
                  <FiArrowRight className='h-3.5 w-3.5' />
                </motion.button>
              </div>
            </div>
          </motion.nav>

          {/* ── HERO ── */}
          <section
            className='relative px-6 pt-36 pb-16 max-w-6xl mx-auto text-center'
            style={{ zIndex: 1 }}
          >
            <motion.div initial='hidden' animate='show' variants={stagger}>
              <motion.div variants={fadeUp}>
                <div
                  className='inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold'
                  style={{
                    background: 'rgba(124,58,237,0.10)',
                    color: VIOLET_DEEP,
                    border: '1px solid rgba(124,58,237,0.22)',
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
                  color: INK,
                }}
              >
                Your complete personal
                <br />
                <span
                  style={{
                    background: `linear-gradient(135deg, ${VIOLET_DEEP}, ${VIOLET}, #a78bfa)`,
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
                style={{ color: BODY }}
              >
                Track net worth, stocks, mutual funds, SIPs, bonds, crypto, gold,
                FDs, PPF, NPS, insurance, receivables and expenses across 20+
                asset classes. Import from Zerodha, Groww, Angel One &amp;
                INDmoney. No broker credentials required — your data stays
                private and encrypted.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className='flex flex-wrap items-center justify-center gap-3 mb-10'
              >
                <motion.button
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  className='flex cursor-pointer items-center gap-3 px-7 py-4 rounded-xl font-bold text-base text-white disabled:opacity-60'
                  style={{
                    background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                    boxShadow:
                      '0 12px 34px rgba(124,58,237,0.38), 0 4px 12px rgba(0,0,0,0.12)',
                    border: 'none',
                  }}
                  whileHover={{ scale: 1.04 } as any}
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
                      <span className='bg-white rounded-md p-0.5 flex'>
                        <FcGoogle className='text-xl' />
                      </span>
                      Continue with Google
                    </>
                  )}
                </motion.button>

                <motion.button
                  onClick={() => setShowRegister(true)}
                  className='flex cursor-pointer items-center gap-3 px-7 py-4 rounded-xl font-bold text-base'
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    color: VIOLET_DEEP,
                    border: '1px solid rgba(124,58,237,0.28)',
                    backdropFilter: 'blur(10px)',
                  }}
                  whileHover={{ scale: 1.04 } as any}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <FiMail className='text-xl' style={{ color: VIOLET }} />
                  Sign up with Email
                </motion.button>
              </motion.div>

              {/* Already have account */}
              <motion.div variants={fadeUp} className='mb-6'>
                <p className='text-sm' style={{ color: MUTED }}>
                  Already have an account?{' '}
                  <button
                    onClick={() => setShowLogin(true)}
                    style={{
                      color: VIOLET,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
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
                className='flex flex-wrap items-center justify-center gap-3 mb-14'
              >
                {trustPills.map((s, i) => (
                  <div
                    key={i}
                    className='flex cursor-pointer items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium'
                    style={{
                      background: 'rgba(255,255,255,0.7)',
                      border: '1px solid rgba(124,58,237,0.14)',
                      color: BODY,
                    }}
                  >
                    <FiCheck
                      className='h-3 w-3 flex-shrink-0'
                      style={{ color: VIOLET }}
                    />
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
                maxWidth: 880,
                background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(124,58,237,0.18)',
                boxShadow: '0 40px 90px rgba(76,29,149,0.22)',
              }}
            >
              {/* Browser chrome */}
              <div
                className='flex items-center gap-2 px-4 py-3'
                style={{
                  borderBottom: '1px solid rgba(124,58,237,0.12)',
                  background: 'rgba(124,58,237,0.05)',
                }}
              >
                <div className='h-3 w-3 rounded-full bg-red-400' />
                <div className='h-3 w-3 rounded-full bg-yellow-400' />
                <div className='h-3 w-3 rounded-full bg-green-400' />
                <div
                  className='ml-3 flex-1 max-w-xs rounded-md px-3 py-1 text-xs'
                  style={{
                    background: 'rgba(124,58,237,0.08)',
                    color: MUTED,
                  }}
                >
                  fintrackly.app/dashboard
                </div>
              </div>

              {/* Stats */}
              <div className='p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left'>
                {[
                  { label: 'Net Worth', value: '₹48.2L', change: '+18.2%', color: VIOLET },
                  { label: 'Total Assets', value: '₹54.6L', change: '67 assets', color: '#6366f1' },
                  { label: 'Liabilities', value: '₹6.4L', change: '3 loans', color: '#c026d3' },
                  { label: 'Savings Rate', value: '60%', change: '↑ 5%', color: VIOLET_DEEP },
                ].map((card) => (
                  <div
                    key={card.label}
                    className='rounded-xl p-4'
                    style={{
                      background: 'rgba(124,58,237,0.04)',
                      border: '1px solid rgba(124,58,237,0.10)',
                    }}
                  >
                    <p className='text-xs mb-1' style={{ color: MUTED }}>
                      {card.label}
                    </p>
                    <p className='text-xl font-bold' style={{ color: INK }}>
                      {card.value}
                    </p>
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
                    background: 'rgba(124,58,237,0.03)',
                    border: '1px solid rgba(124,58,237,0.10)',
                  }}
                >
                  <div className='flex items-center justify-between mb-4'>
                    <p className='text-sm font-semibold' style={{ color: INK }}>
                      Net Worth Over Time
                    </p>
                    <span
                      className='text-xs px-2 py-1 rounded-full font-semibold'
                      style={{
                        background: 'rgba(124,58,237,0.12)',
                        color: VIOLET_DEEP,
                        border: '1px solid rgba(124,58,237,0.22)',
                      }}
                    >
                      +18.2% YTD
                    </span>
                  </div>
                  <svg width='100%' height='64' viewBox='0 0 400 64' preserveAspectRatio='none'>
                    <defs>
                      <linearGradient id='cg' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='0%' stopColor={VIOLET} stopOpacity='0.32' />
                        <stop offset='100%' stopColor={VIOLET} stopOpacity='0' />
                      </linearGradient>
                    </defs>
                    <path
                      d='M0,52 C40,48 70,44 100,38 C130,32 160,40 200,28 C240,16 270,22 300,14 C330,8 360,10 400,4'
                      fill='none'
                      stroke={VIOLET}
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
                          className='text-[11px] font-medium'
                          style={{ color: MUTED }}
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
          <section className='px-6 py-20 relative' id='how-it-works' style={{ zIndex: 1 }}>
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
                    style={{ color: VIOLET }}
                  >
                    Simple as 1-2-3
                  </p>
                  <h2 className='text-3xl md:text-4xl font-black tracking-tight' style={{ color: INK }}>
                    Get your net worth in under 5 minutes
                  </h2>
                </motion.div>

                <div className='grid md:grid-cols-3 gap-5'>
                  {[
                    {
                      step: '01',
                      title: 'Sign up in 10 seconds',
                      desc: "One-click Google sign-in, or create an account with email. Fill a quick profile and you're in.",
                      icon: <span className='bg-white rounded p-0.5 inline-flex'><FcGoogle className='text-xl' /></span>,
                    },
                    {
                      step: '02',
                      title: 'Add your assets',
                      desc: 'Enter manually, use CSV/Excel templates, or import directly from Zerodha, Groww or Angel One.',
                      icon: <FiUpload style={{ color: VIOLET }} className='text-xl' />,
                    },
                    {
                      step: '03',
                      title: 'See your complete picture',
                      desc: 'Dashboard shows net worth, income vs expenses, allocation splits and goal progress — kept in sync automatically.',
                      icon: <FiBarChart2 style={{ color: VIOLET_DEEP }} className='text-xl' />,
                    },
                  ].map((item) => (
                    <motion.div
                      key={item.step}
                      variants={fadeUp}
                      className='rounded-2xl p-7'
                      style={glassCard}
                      whileHover={{ y: -5 } as any}
                      transition={{ duration: 0.2 }}
                    >
                      <div className='flex items-center gap-3 mb-5'>
                        <span
                          className='text-xs font-black tracking-widest'
                          style={{ color: 'rgba(124,58,237,0.35)' }}
                        >
                          {item.step}
                        </span>
                        <div
                          className='h-9 w-9 rounded-xl flex items-center justify-center'
                          style={{
                            background: 'rgba(124,58,237,0.08)',
                            border: '1px solid rgba(124,58,237,0.16)',
                          }}
                        >
                          {item.icon}
                        </div>
                      </div>
                      <h3 className='text-sm font-bold mb-2' style={{ color: INK }}>
                        {item.title}
                      </h3>
                      <p className='text-sm leading-relaxed' style={{ color: BODY }}>
                        {item.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>

          {/* ── FEATURES GRID ── */}
          <section className='px-6 py-20 max-w-6xl mx-auto relative' id='features' style={{ zIndex: 1 }}>
            <motion.div
              initial='hidden'
              whileInView='show'
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
            >
              <motion.div variants={fadeUp} className='text-center mb-12'>
                <p
                  className='text-xs font-bold uppercase tracking-widest mb-3'
                  style={{ color: VIOLET }}
                >
                  Everything you need
                </p>
                <h2 className='text-3xl md:text-4xl font-black tracking-tight' style={{ color: INK }}>
                  Built for how Indians actually invest
                </h2>
                <p className='mt-3 max-w-2xl mx-auto text-sm' style={{ color: BODY }}>
                  Fully built modules — stocks, mutual funds, SIPs, bonds with
                  auto-synced interest, crypto, gold, FDs, PPF, NPS, receivables,
                  expenses, liabilities and goals. Every feature is live and
                  ready to use.
                </p>
              </motion.div>

              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    className='p-6 rounded-2xl relative overflow-hidden cursor-default'
                    style={glassCard}
                    onHoverStart={() => setHoveredFeature(i)}
                    onHoverEnd={() => setHoveredFeature(null)}
                    whileHover={{ y: -4 } as any}
                    transition={{ duration: 0.2 }}
                  >
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
                        background: f.glow,
                        border: `1px solid ${f.color}30`,
                        color: f.color,
                      }}
                    >
                      {f.icon}
                    </div>
                    <h3 className='text-sm font-bold mb-2' style={{ color: INK }}>
                      {f.label}
                    </h3>
                    <p className='text-sm leading-relaxed mb-4' style={{ color: BODY }}>
                      {f.desc}
                    </p>

                    <div
                      className='overflow-hidden transition-all duration-300'
                      style={{
                        maxHeight: hoveredFeature === i ? '220px' : '0px',
                        opacity: hoveredFeature === i ? 1 : 0,
                      }}
                    >
                      <div
                        className='pt-3'
                        style={{ borderTop: `1px solid ${f.color}22` }}
                      >
                        {f.bullets.map((b, bi) => (
                          <div key={bi} className='flex items-start gap-2 mb-1.5'>
                            <FiCheck
                              className='mt-0.5 flex-shrink-0 h-3 w-3'
                              style={{ color: f.color }}
                            />
                            <span className='text-xs leading-snug' style={{ color: BODY }}>
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
          <section className='px-6 py-20 max-w-5xl mx-auto relative' id='privacy' style={{ zIndex: 1 }}>
            <motion.div
              initial='hidden'
              whileInView='show'
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
            >
              <motion.div variants={fadeUp} className='text-center mb-12'>
                <p
                  className='text-xs font-bold uppercase tracking-widest mb-3'
                  style={{ color: VIOLET }}
                >
                  Your data, your rules
                </p>
                <h2 className='text-3xl md:text-4xl font-black tracking-tight' style={{ color: INK }}>
                  Privacy is not a feature.
                  <br />
                  It's the foundation.
                </h2>
              </motion.div>

              <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                {[
                  { icon: <FiShield />, title: 'No Broker Access', desc: 'We never connect to your brokerage or bank. You control what gets entered.', color: VIOLET },
                  { icon: <FiLock />, title: 'No Data Selling', desc: "Your financial data is yours alone. We don't sell, share or monetise it. Ever.", color: '#6366f1' },
                  { icon: <FiDownload />, title: 'Full Data Export', desc: 'Export everything as CSV, Excel or JSON anytime. Your data is always portable.', color: '#8b5cf6' },
                  { icon: <FiDatabase />, title: 'Delete Any Time', desc: 'One click erases your entire account and all data — server-enforced, nothing left behind.', color: '#9333ea' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    className='p-6 rounded-2xl'
                    style={glassCard}
                    whileHover={{ y: -4 } as any}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className='h-10 w-10 rounded-xl flex items-center justify-center text-lg mb-4'
                      style={{
                        background: `${item.color}18`,
                        border: `1px solid ${item.color}30`,
                        color: item.color,
                      }}
                    >
                      {item.icon}
                    </div>
                    <h3 className='text-sm font-bold mb-2' style={{ color: INK }}>
                      {item.title}
                    </h3>
                    <p className='text-sm leading-relaxed' style={{ color: BODY }}>
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
              style={{
                ...glassCard,
                background:
                  'linear-gradient(160deg, rgba(124,58,237,0.10), rgba(168,85,247,0.06))',
                border: '1px solid rgba(124,58,237,0.20)',
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className='relative'>
                <h2 className='text-3xl md:text-4xl font-black tracking-tight mb-4' style={{ color: INK }}>
                  Ready to see your true net worth?
                </h2>
                <p className='mb-10 text-lg' style={{ color: BODY }}>
                  Join Indian investors who track stocks, mutual funds, SIPs,
                  bonds, crypto, gold, FDs, PPF, receivables and expenses on
                  Fintrackly.
                </p>
                <div className='flex flex-wrap items-center justify-center gap-3'>
                  <motion.button
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                    className='inline-flex items-center cursor-pointer gap-3 px-8 py-4 rounded-xl font-bold text-base text-white disabled:opacity-60'
                    style={{
                      background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                      boxShadow: '0 14px 36px rgba(124,58,237,0.4)',
                      border: 'none',
                    }}
                    whileHover={{ scale: 1.05 } as any}
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
                        <span className='bg-white rounded-md p-0.5 flex'>
                          <FcGoogle className='text-xl' />
                        </span>
                        Continue with Google
                        <FiArrowRight />
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    onClick={() => setShowRegister(true)}
                    className='inline-flex items-center cursor-pointer gap-3 px-8 py-4 rounded-xl font-bold text-base'
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      color: VIOLET_DEEP,
                      border: '1px solid rgba(124,58,237,0.28)',
                    }}
                    whileHover={{ scale: 1.04 } as any}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                  >
                    <FiMail className='text-xl' style={{ color: VIOLET }} />
                    Sign up with Email
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── SEO KEYWORD SECTION ── */}
          <section
            className='px-6 py-16 relative'
            style={{ zIndex: 1, borderTop: '1px solid rgba(124,58,237,0.10)' }}
          >
            <div className='max-w-5xl mx-auto text-center'>
              <p
                className='text-xs font-bold uppercase tracking-widest mb-6'
                style={{ color: 'rgba(124,58,237,0.6)' }}
              >
                What you can track with Fintrackly
              </p>
              <div className='flex flex-wrap justify-center gap-2'>
                {keywordTags.map((tag, i) => (
                  <span
                    key={i}
                    className='px-3 py-1.5 rounded-full text-xs cursor-pointer'
                    style={{
                      background: 'rgba(124,58,237,0.06)',
                      border: '1px solid rgba(124,58,237,0.12)',
                      color: BODY,
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
            style={{ borderTop: '1px solid rgba(124,58,237,0.12)', zIndex: 1 }}
          >
            <div className='flex items-center justify-center gap-2 mb-4'>
              <div
                className='h-6 w-6 rounded-md flex items-center justify-center'
                style={{
                  background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                  boxShadow: '0 6px 14px rgba(124,58,237,0.3)',
                }}
              >
                <FiTrendingUp className='text-white h-3.5 w-3.5' />
              </div>
              <span className='text-sm font-bold' style={{ color: INK }}>
                Fin<span style={{ color: VIOLET }}>Trackly</span>
              </span>
            </div>
            <nav className='flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-4 text-sm'>
              <a href='/privacy' className='font-medium' style={{ color: BODY }}>
                Privacy
              </a>
              <a href='/terms' className='font-medium' style={{ color: BODY }}>
                Terms &amp; Conditions
              </a>
              <a href='/contact' className='font-medium' style={{ color: BODY }}>
                Contact Us
              </a>
            </nav>
            <p className='text-xs' style={{ color: MUTED }}>
              © 2026 Fintrackly · Personal finance tracker &amp; investment
              portfolio manager for India · Made in India
            </p>
          </footer>
        </div>
      )}
    </>
  );
}
