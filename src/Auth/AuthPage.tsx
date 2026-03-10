// src/pages/Auth/AuthPage.tsx
import { auth, googleProvider } from '../../src/services/firebase';
import { signInWithPopup } from 'firebase/auth';
import { motion, type Variants } from 'framer-motion';
import { useState } from 'react';
import {
  FiTrendingUp, FiFileText, FiTarget,
  FiLock, FiDownload, FiDollarSign, FiBarChart2,
  FiShield, FiCheck, FiArrowRight, FiUpload,
  FiPackage, FiCamera, FiBookOpen, FiCreditCard,
  FiHome, FiBriefcase, FiAlertCircle, FiZap,
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { SiNotion } from 'react-icons/si';

// ── Animation Variants ────────────────────────────────────────────────────────

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// ── Data ──────────────────────────────────────────────────────────────────────

const features = [
  { icon: <FiBarChart2 />, color: "#10b981", glow: "rgba(16,185,129,0.25)", label: "Dashboard", desc: "Unified net worth overview with live asset allocation, P&L charts, income vs expense burn, and portfolio health score." },
  { icon: <FiDollarSign />, color: "#3b82f6", glow: "rgba(59,130,246,0.25)", label: "Income & Expense", desc: "Categorized transaction tracking with monthly trends, custom tags, recurring entries, and AI-powered spending insights." },
  { icon: <FiBriefcase />, color: "#a78bfa", glow: "rgba(167,139,250,0.25)", label: "Investments", desc: "Track stocks, mutual funds, ETFs, FDs, gold, crypto and real estate. See XIRR, absolute returns and dividend history." },
  { icon: <FiHome />, color: "#f59e0b", glow: "rgba(245,158,11,0.25)", label: "Assets", desc: "Log physical and financial assets — property, vehicles, jewellery, EPF, PPF. Attach documents and get reminders." },
  { icon: <FiCreditCard />, color: "#f87171", glow: "rgba(248,113,113,0.25)", label: "Liabilities", desc: "Full loan management: EMI schedules, remaining tenure, prepayment simulation, and missed payment alerts." },
  { icon: <FiTarget />, color: "#ec4899", glow: "rgba(236,72,153,0.25)", label: "Goals", desc: "Set FIRE, retirement, home-purchase or custom goals. Get SIP calculations and auto-progress tracking." },
  { icon: <FiCamera />, color: "#fb923c", glow: "rgba(251,146,60,0.25)", label: "Snapshots", desc: "Create point-in-time net worth snapshots monthly or on demand. Compare over time to see your wealth journey." },
  { icon: <FiFileText />, color: "#22d3ee", glow: "rgba(34,211,238,0.25)", label: "Reports", desc: "Generate PDF and Excel reports: annual wealth statements, capital gains reports and custom date-range P&L." },
  { icon: <SiNotion />, color: "#e2e8f0", glow: "rgba(226,232,240,0.15)", label: "Notion Sync", desc: "Two-way sync with your Notion workspace. Push investments, expenses and snapshots — no manual copy-paste." },
  { icon: <FiPackage />, color: "#818cf8", glow: "rgba(129,140,248,0.25)", label: "Import / Export", desc: "Import from Zerodha, Angel One, Groww, INDmoney. Export as JSON, CSV, or Excel. Full data portability." },
  { icon: <FiBookOpen />, color: "#38bdf8", glow: "rgba(56,189,248,0.25)", label: "Essentials", desc: "Built-in calculators: SIP, lumpsum, loan EMI, compound interest, CAGR and more for daily money decisions." },
  { icon: <FiShield />, color: "#34d399", glow: "rgba(52,211,153,0.25)", label: "Privacy", desc: "All data encrypted at rest and in transit. No third-party data sharing. You own 100% of your financial data." },
];

const glassBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(12px)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in", error);
    }
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "#020b18", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── STATIC BG — pure CSS, zero JS cost ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 55% at 50% -5%, rgba(16,185,129,0.14) 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 40% at 95% 80%, rgba(59,130,246,0.09) 0%, transparent 55%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 45% 35% at 0% 55%, rgba(167,139,250,0.08) 0%, transparent 55%)" }} />
      </div>

      {/* ── NAVBAR ── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 w-full z-50"
        style={{ background: "rgba(2,11,24,0.75)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 14px rgba(16,185,129,0.45)" }}>
              <FiTrendingUp className="text-white h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">FinTrackly</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
              Beta
            </span>
          </div>

          <motion.button
            onClick={handleGoogleSignIn}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}
            whileHover={{ scale: 1.04, background: "rgba(16,185,129,0.25)" } as any}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            Get Started Free
            <FiArrowRight className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative px-6 pt-36 pb-20 max-w-6xl mx-auto text-center" style={{ zIndex: 1 }}>
        <motion.div initial="hidden" animate="show" variants={stagger}>

          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold"
              style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
              <FiZap className="h-3 w-3" />
              Built for Indian investors · 100% private
            </div>
          </motion.div>

          <motion.h1 variants={fadeUp}
            className="font-black tracking-tighter mb-6"
            style={{ fontSize: "clamp(38px, 6.5vw, 78px)", lineHeight: 1.06, color: "#f8fafc" }}>
            Know your true wealth
            <br />
            <span style={{
              background: "linear-gradient(135deg, #10b981, #34d399, #6ee7b7)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              at a glance.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp}
            className="text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "rgba(226,232,240,0.52)" }}>
            Track net worth, income, expenses, and financial goals across 20+ asset classes.
            No broker credentials. No third-party tracking. Just you and your data.
          </motion.p>

          <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mb-12">
            <motion.button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-3 px-7 py-4 rounded-xl font-bold text-base text-white"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: "0 0 36px rgba(16,185,129,0.35), 0 4px 20px rgba(0,0,0,0.35)",
              }}
              whileHover={{ scale: 1.04, boxShadow: "0 0 54px rgba(16,185,129,0.5), 0 4px 24px rgba(0,0,0,0.4)" } as any}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <FcGoogle className="text-xl" />
              Continue with Google
            </motion.button>
          </motion.div>

          {/* Trust pills */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3 mb-16">
            {["20+ Asset Classes", "No Broker Access", "100% Encrypted", "Notion Sync"].map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(226,232,240,0.55)" }}>
                <FiCheck className="text-emerald-400 h-3 w-3 flex-shrink-0" />
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
          className="rounded-2xl overflow-hidden mx-auto"
          style={{
            maxWidth: 860,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 32px 72px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <div className="ml-3 flex-1 max-w-xs rounded-md px-3 py-1 text-xs"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(226,232,240,0.3)" }}>
              fintrackly.app/dashboard
            </div>
          </div>

          {/* Stats */}
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            {[
              { label: "Net Worth", value: "₹48.2L", change: "+18.2%", color: "#10b981" },
              { label: "Total Assets", value: "₹54.6L", change: "67 assets", color: "#3b82f6" },
              { label: "Liabilities", value: "₹6.4L", change: "3 loans", color: "#f87171" },
              { label: "Savings Rate", value: "60%", change: "↑ 5%", color: "#a78bfa" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs mb-1" style={{ color: "rgba(226,232,240,0.4)" }}>{card.label}</p>
                <p className="text-xl font-bold text-white">{card.value}</p>
                <p className="text-xs font-semibold mt-1" style={{ color: card.color }}>{card.change}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="px-5 pb-5">
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: "rgba(226,232,240,0.8)" }}>Net Worth Over Time</p>
                <span className="text-xs px-2 py-1 rounded-full font-semibold"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                  +18.2% YTD
                </span>
              </div>
              <svg width="100%" height="64" viewBox="0 0 400 64" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,52 C40,48 70,44 100,38 C130,32 160,40 200,28 C240,16 270,22 300,14 C330,8 360,10 400,4"
                  fill="none" stroke="#10b981" strokeWidth="2.5" />
                <path d="M0,52 C40,48 70,44 100,38 C130,32 160,40 200,28 C240,16 270,22 300,14 C330,8 360,10 400,4 L400,64 L0,64 Z"
                  fill="url(#cg)" />
              </svg>
              <div className="flex justify-between mt-2">
                {["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"].map((m) => (
                  <span key={m} className="text-[10px]" style={{ color: "rgba(226,232,240,0.2)" }}>{m}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-6 py-20 relative" id="how-it-works" style={{ zIndex: 1 }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#10b981" }}>Simple as 1-2-3</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Get your net worth in under 5 minutes
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                { step: "01", title: "Sign up in 10 seconds", desc: "One-click Google sign-in. Fill in a quick profile and you're in.", icon: <FcGoogle className="text-2xl" /> },
                { step: "02", title: "Add your assets", desc: "Enter manually, use CSV/Excel templates, or import directly from Zerodha or Groww.", icon: <FiUpload style={{ color: "#10b981" }} className="text-xl" /> },
                { step: "03", title: "See your complete picture", desc: "Dashboard shows net worth, income vs expenses, allocation breakdown and goal progress.", icon: <FiBarChart2 style={{ color: "#3b82f6" }} className="text-xl" /> },
              ].map((item) => (
                <motion.div key={item.step} variants={fadeUp}
                  className="rounded-2xl p-7"
                  style={glassBase}
                  whileHover={{ y: -5, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" } as any}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs font-black tracking-widest" style={{ color: "rgba(255,255,255,0.14)" }}>{item.step}</span>
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(226,232,240,0.48)" }}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="px-6 py-20 max-w-6xl mx-auto relative" id="features" style={{ zIndex: 1 }}>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#10b981" }}>Everything you need</p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Built for how Indians actually invest
            </h2>
            <p className="mt-3 max-w-xl mx-auto text-sm" style={{ color: "rgba(226,232,240,0.42)" }}>
              From EPF to equity, SIPs to SGBs — FinTrackly understands Indian finances.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="p-6 rounded-2xl relative overflow-hidden cursor-default"
                style={glassBase}
                onHoverStart={() => setHoveredFeature(i)}
                onHoverEnd={() => setHoveredFeature(null)}
                whileHover={{ y: -4, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" } as any}
                transition={{ duration: 0.2 }}
              >
                {/* Top accent line — CSS only */}
                <div className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${f.color}, transparent)`,
                    opacity: hoveredFeature === i ? 1 : 0,
                  }} />

                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg mb-4"
                  style={{ background: `${f.glow.replace("0.25", "0.12")}`, border: `1px solid ${f.color}28`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{f.label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(226,232,240,0.44)" }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── NOTION SYNC ── */}
      <section className="px-6 py-20 max-w-5xl mx-auto relative" style={{ zIndex: 1 }}>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-6"
              style={glassBase}>
              <SiNotion className="text-white text-xl" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-4">
              Notion Ecosystem Integration
            </h2>
            <p className="leading-relaxed mb-7 text-sm" style={{ color: "rgba(226,232,240,0.48)" }}>
              Keep your entire financial system inside Notion. FinTrackly's serverless workers push live data to your workspace so Notion remains your single source of truth.
            </p>
            <div className="space-y-3">
              {[
                "Push investments to a Notion database table",
                "Sync monthly expense summaries automatically",
                "Trigger snapshot creation from Notion buttons",
                "Goal progress updates in your life OS",
                "Two-way sync with conflict resolution",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm" style={{ color: "rgba(226,232,240,0.62)" }}>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.28)" }}>
                    <FiCheck className="text-emerald-400 text-xs" />
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
            <div className="rounded-2xl overflow-hidden" style={glassBase}>
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-sm font-semibold text-white">Notion Sync Status</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#10b981" }}>
                  <div className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #10b981" }} />
                  LIVE
                </div>
              </div>
              {[
                { db: "📊 Investments", rows: "142 holdings", time: "2 min ago" },
                { db: "💸 Expenses", rows: "38 this month", time: "5 min ago" },
                { db: "🎯 Goals", rows: "4 active goals", time: "1 hr ago" },
                { db: "📸 Snapshots", rows: "12 snapshots", time: "Yesterday" },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <div className="text-sm font-medium text-white">{row.db}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(226,232,240,0.35)" }}>{row.rows}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium" style={{ color: "#10b981" }}>✓ synced</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(226,232,240,0.25)" }}>{row.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PRIVACY ── */}
      <section className="px-6 py-20 max-w-5xl mx-auto relative" id="privacy" style={{ zIndex: 1 }}>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#10b981" }}>Your data, your rules</p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Privacy is not a feature.<br />It's the foundation.
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <FiShield />, title: "No Broker Access", desc: "We never connect to your brokerage or bank accounts. You control what gets entered.", color: "#10b981" },
              { icon: <FiLock />, title: "No Data Selling", desc: "Your financial data is yours alone. We don't sell, share, or monetize it. Ever.", color: "#3b82f6" },
              { icon: <FiDownload />, title: "Full Data Export", desc: "Export all your data as CSV or JSON anytime. Your data is always accessible.", color: "#a78bfa" },
              { icon: <FiAlertCircle />, title: "Delete Any Time", desc: "One click deletes your entire account and all data. No retention, no dark patterns.", color: "#f87171" },
            ].map((item, i) => (
              <motion.div key={i} variants={fadeUp}
                className="p-6 rounded-2xl"
                style={glassBase}
                whileHover={{ y: -4, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" } as any}
                transition={{ duration: 0.2 }}
              >
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg mb-4"
                  style={{ background: `${item.color}18`, border: `1px solid ${item.color}28`, color: item.color }}>
                  {item.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(226,232,240,0.44)" }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-20 relative" style={{ zIndex: 1 }}>
        <motion.div
          className="max-w-3xl mx-auto text-center rounded-3xl p-12 relative overflow-hidden"
          style={glassBase}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 65% 45% at 50% 0%, rgba(16,185,129,0.1), transparent)" }} />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
              Ready to see your true wealth?
            </h2>
            <p className="mb-10 text-lg" style={{ color: "rgba(226,232,240,0.48)" }}>
              Join thousands of Indian investors who track their complete financial picture on FinTrackly.
            </p>
            <motion.button
              onClick={handleGoogleSignIn}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base text-white"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: "0 0 40px rgba(16,185,129,0.38), 0 6px 28px rgba(0,0,0,0.38)",
              }}
              whileHover={{ scale: 1.05, boxShadow: "0 0 60px rgba(16,185,129,0.55), 0 6px 32px rgba(0,0,0,0.42)" } as any}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <FcGoogle className="text-xl" />
              Start Free with Google
              <FiArrowRight />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 text-center relative" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", zIndex: 1 }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 0 10px rgba(16,185,129,0.4)" }}>
            <FiTrendingUp className="text-white h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-bold" style={{ color: "rgba(226,232,240,0.65)" }}>FinTrackly</span>
        </div>
        <p className="text-xs" style={{ color: "rgba(226,232,240,0.2)" }}>© 2026 FinTrackly · Privacy-first net worth tracking</p>
      </footer>
    </div>
  );
}