// src/components/ui/SectionLoader.tsx
// Themed animated loaders — one per section of the app.

import type { FC } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   Shared keyframe block — injected once via <style> in each loader
───────────────────────────────────────────────────────────────────────────── */
const BASE_CSS = `
  @keyframes sl-fade-up   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sl-pulse-dot { 0%,80%,100% { transform:scale(0.6); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
  @keyframes sl-bar       { 0%,100% { transform:scaleY(.35); } 50% { transform:scaleY(1); } }
  @keyframes sl-spin      { to { transform:rotate(360deg); } }
  @keyframes sl-leaf      { 0%,100% { transform:rotate(-18deg) scale(.85); } 50% { transform:rotate(18deg) scale(1.05); } }
  @keyframes sl-wave      { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
  @keyframes sl-orbit     { from { transform:rotate(0deg) translateX(22px) rotate(0deg); } to { transform:rotate(360deg) translateX(22px) rotate(-360deg); } }
  @keyframes sl-shimmer   { 0%,100% { opacity:.4; } 50% { opacity:1; } }
  @keyframes sl-coin      { 0%,100% { transform:rotateY(0deg); } 50% { transform:rotateY(180deg); } }
  @keyframes sl-arrow     { 0%,100% { transform:translateY(0); opacity:1; } 50% { transform:translateY(-6px); opacity:.5; } }
  @keyframes sl-dash      { to { stroke-dashoffset:0; } }
  @keyframes sl-blink     { 0%,100% { opacity:1; } 50% { opacity:.2; } }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   Wrapper — centred card used by all loaders
───────────────────────────────────────────────────────────────────────────── */
const Wrap: FC<{ children: React.ReactNode; minH?: string }> = ({
  children,
  minH = 'h-64',
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-5 ${minH} w-full select-none`}
  >
    <style>{BASE_CSS}</style>
    {children}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Dot row — reused by several loaders
───────────────────────────────────────────────────────────────────────────── */
const Dots: FC<{ color: string }> = ({ color }) => (
  <div className='flex gap-1.5'>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          animation: `sl-pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Label row
───────────────────────────────────────────────────────────────────────────── */
const Label: FC<{ text: string; color: string }> = ({ text, color }) => (
  <p
    style={{
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '0.04em',
      color,
      animation: 'sl-fade-up .5s ease both',
    }}
  >
    {text}
  </p>
);

/* ═══════════════════════════════════════════════════════════════════════════
   1. PORTFOLIO / APP-LEVEL  (full-screen — already handled by Loader.tsx)
   Keeping this here as an alias in case used elsewhere.
═══════════════════════════════════════════════════════════════════════════ */
export const PortfolioLoader: FC = () => (
  <Wrap>
    {/* Animated bar chart */}
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 48 }}
    >
      {[30, 20, 40, 28, 48, 36, 56].map((h, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: h,
            borderRadius: '3px 3px 0 0',
            background: `rgba(16,185,129,${0.3 + i * 0.1})`,
            transformOrigin: 'bottom',
            animation: `sl-bar 1s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
    <Label text='Loading your portfolio…' color='#10b981' />
    <Dots color='#10b981' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   2. AGRICULTURE  🌾 — swaying leaf + soil rows
═══════════════════════════════════════════════════════════════════════════ */
export const AgricultureLoader: FC = () => (
  <Wrap>
    {/* Animated plant */}
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      {/* Stem */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 3,
          height: 40,
          background: 'linear-gradient(to top,#15803d,#4ade80)',
          borderRadius: 4,
        }}
      />
      {/* Left leaf */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: 8,
          width: 20,
          height: 12,
          background: 'linear-gradient(135deg,#16a34a,#86efac)',
          borderRadius: '50% 0 50% 0',
          animation: 'sl-leaf 1.8s ease-in-out infinite',
          transformOrigin: 'right center',
        }}
      />
      {/* Right leaf */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 8,
          width: 20,
          height: 12,
          background: 'linear-gradient(135deg,#22c55e,#bbf7d0)',
          borderRadius: '0 50% 0 50%',
          animation: 'sl-leaf 1.8s ease-in-out .4s infinite',
          transformOrigin: 'left center',
        }}
      />
      {/* Sun dot */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          right: 4,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'radial-gradient(circle,#fde047,#facc15)',
          boxShadow: '0 0 10px 2px rgba(250,204,21,.5)',
          animation: 'sl-shimmer 2s ease infinite',
        }}
      />
      {/* Ground */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: 'linear-gradient(90deg,#92400e,#a16207,#78350f)',
          borderRadius: 4,
        }}
      />
    </div>

    {/* Soil rows skeleton */}
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 180 }}
    >
      {[100, 75, 88].map((w, i) => (
        <div
          key={i}
          style={{
            height: 8,
            width: `${w}%`,
            borderRadius: 4,
            background: 'rgba(134,197,97,.15)',
            animation: `sl-shimmer 1.6s ease ${i * 0.25}s infinite`,
          }}
        />
      ))}
    </div>

    <Label text='Loading agriculture data…' color='#4ade80' />
    <Dots color='#4ade80' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. INSIGHTS  🧠 — orbiting brain dots
═══════════════════════════════════════════════════════════════════════════ */
export const InsightsLoader: FC = () => (
  <Wrap>
    {/* Orbit ring */}
    <div style={{ position: 'relative', width: 72, height: 72 }}>
      {/* Centre icon */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          animation: 'sl-shimmer 2s ease infinite',
        }}
      >
        🧠
      </div>
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${i * 120}deg)`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: ['#818cf8', '#a78bfa', '#c4b5fd'][i],
              animation: `sl-orbit 2s linear ${i * 0.33}s infinite`,
              boxShadow: `0 0 8px 2px ${['rgba(129,140,248,.6)', 'rgba(167,139,250,.6)', 'rgba(196,181,253,.6)'][i]}`,
            }}
          />
        </div>
      ))}
    </div>

    {/* Skeleton lines */}
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 200 }}
    >
      {[90, 65, 80, 50].map((w, i) => (
        <div
          key={i}
          style={{
            height: 7,
            width: `${w}%`,
            borderRadius: 4,
            background: 'rgba(129,140,248,.15)',
            animation: `sl-shimmer 1.4s ease ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>

    <Label text='Generating insights…' color='#818cf8' />
    <Dots color='#818cf8' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. INVESTMENTS  📈 — animated candlestick chart
═══════════════════════════════════════════════════════════════════════════ */
export const InvestmentsLoader: FC = () => (
  <Wrap>
    <svg width='160' height='64' viewBox='0 0 160 64'>
      {/* Candlesticks */}
      {[
        { x: 12, low: 42, high: 10, open: 36, close: 18, bull: false },
        { x: 32, low: 50, high: 20, open: 44, close: 28, bull: true },
        { x: 52, low: 40, high: 8, open: 34, close: 16, bull: true },
        { x: 72, low: 54, high: 18, open: 48, close: 26, bull: false },
        { x: 92, low: 36, high: 6, open: 30, close: 14, bull: true },
        { x: 112, low: 48, high: 12, open: 42, close: 20, bull: true },
        { x: 132, low: 44, high: 4, open: 38, close: 10, bull: true },
      ].map(({ x, low, high, open, close, bull }, i) => {
        const c = bull ? '#22c55e' : '#f43f5e';
        const delay = `${i * 0.1}s`;
        return (
          <g
            key={i}
            style={{ animation: `sl-shimmer 1.5s ease ${delay} infinite` }}
          >
            <line
              x1={x + 5}
              y1={high}
              x2={x + 5}
              y2={low}
              stroke={c}
              strokeWidth='1.5'
            />
            <rect
              x={x}
              y={Math.min(open, close)}
              width={10}
              height={Math.max(2, Math.abs(open - close))}
              fill={bull ? c : 'none'}
              stroke={c}
              strokeWidth='1.5'
              rx='1'
            />
          </g>
        );
      })}
    </svg>
    <Label text='Loading investments…' color='#22c55e' />
    <Dots color='#22c55e' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   5. CASHFLOW  💸 — flowing arrow stream
═══════════════════════════════════════════════════════════════════════════ */
export const CashflowLoader: FC = () => (
  <Wrap>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Income arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 70,
            height: 6,
            borderRadius: 3,
            background: 'linear-gradient(90deg,transparent,#10b981)',
            animation: 'sl-shimmer 1.2s ease infinite',
          }}
        />
        <span style={{ fontSize: 18, animation: 'sl-arrow 1s ease infinite' }}>
          ↑
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>
          Income
        </span>
      </div>
      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'rgba(148,163,184,.1)',
            border: '1.5px solid rgba(148,163,184,.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          ₹
        </div>
      </div>
      {/* Expense arrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 70,
            height: 6,
            borderRadius: 3,
            background: 'linear-gradient(90deg,transparent,#f43f5e)',
            animation: 'sl-shimmer 1.2s ease .3s infinite',
          }}
        />
        <span
          style={{
            fontSize: 18,
            color: '#f43f5e',
            animation: 'sl-arrow 1s ease .3s infinite',
          }}
        >
          ↓
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#f43f5e' }}>
          Expense
        </span>
      </div>
    </div>
    <Label text='Loading cashflow…' color='#94a3b8' />
    <Dots color='#94a3b8' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   6. GOALS  🎯 — progress ring filling up
═══════════════════════════════════════════════════════════════════════════ */
export const GoalsLoader: FC = () => (
  <Wrap>
    <div style={{ position: 'relative', width: 72, height: 72 }}>
      {/* Track */}
      <svg width='72' height='72' style={{ position: 'absolute', inset: 0 }}>
        <circle
          cx='36'
          cy='36'
          r='28'
          fill='none'
          stroke='rgba(251,191,36,.12)'
          strokeWidth='6'
        />
        <circle
          cx='36'
          cy='36'
          r='28'
          fill='none'
          stroke='url(#goalGrad)'
          strokeWidth='6'
          strokeLinecap='round'
          strokeDasharray={`${2 * Math.PI * 28}`}
          strokeDashoffset={`${2 * Math.PI * 28 * 0.3}`}
          transform='rotate(-90 36 36)'
          style={{ animation: 'sl-shimmer 1.8s ease infinite' }}
        />
        <defs>
          <linearGradient id='goalGrad' x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' stopColor='#f59e0b' />
            <stop offset='100%' stopColor='#fde68a' />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}
      >
        🎯
      </div>
    </div>
    <Label text='Loading goals…' color='#fbbf24' />
    <Dots color='#fbbf24' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   7. LIABILITIES  📋 — stacked debt slabs shrinking
═══════════════════════════════════════════════════════════════════════════ */
export const LiabilitiesLoader: FC = () => (
  <Wrap>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {[
        { w: 140, c: 'rgba(239,68,68,.7)' },
        { w: 110, c: 'rgba(239,68,68,.5)' },
        { w: 80, c: 'rgba(239,68,68,.3)' },
      ].map(({ w, c }, i) => (
        <div
          key={i}
          style={{
            width: w,
            height: 14,
            borderRadius: 6,
            background: c,
            animation: `sl-shimmer 1.5s ease ${i * 0.25}s infinite`,
          }}
        />
      ))}
      <div style={{ marginTop: 4, fontSize: 20 }}>📉</div>
    </div>
    <Label text='Loading liabilities…' color='#f87171' />
    <Dots color='#f87171' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   8. ACCOUNTS  🏦 — spinning coin
═══════════════════════════════════════════════════════════════════════════ */
export const AccountsLoader: FC = () => (
  <Wrap>
    <div style={{ perspective: 200 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
          boxShadow: '0 4px 24px rgba(251,191,36,.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          animation: 'sl-coin 2s ease-in-out infinite',
        }}
      >
        ₹
      </div>
    </div>
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 180 }}
    >
      {[90, 70, 55].map((w, i) => (
        <div
          key={i}
          style={{
            height: 8,
            width: `${w}%`,
            borderRadius: 4,
            background: 'rgba(251,191,36,.15)',
            animation: `sl-shimmer 1.4s ease ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
    <Label text='Loading accounts…' color='#fbbf24' />
    <Dots color='#fbbf24' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   9. REPORTS / SNAPSHOTS  📊 — drawing a line chart
═══════════════════════════════════════════════════════════════════════════ */
export const ReportsLoader: FC = () => (
  <Wrap>
    <svg width='180' height='64' viewBox='0 0 180 64'>
      <defs>
        <linearGradient id='rGrad' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stopColor='#6366f1' />
          <stop offset='100%' stopColor='#a78bfa' />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[16, 32, 48].map((y) => (
        <line
          key={y}
          x1='0'
          y1={y}
          x2='180'
          y2={y}
          stroke='rgba(99,102,241,.1)'
          strokeWidth='1'
          strokeDasharray='4 4'
        />
      ))}
      {/* Animated path */}
      <path
        d='M0,58 C20,50 35,42 55,32 C75,22 90,28 110,18 C130,8 150,14 180,4'
        fill='none'
        stroke='url(#rGrad)'
        strokeWidth='2.5'
        strokeLinecap='round'
        strokeDasharray='320'
        strokeDashoffset='320'
        style={{
          animation: 'sl-dash 2s cubic-bezier(0.4,0,0.2,1) infinite alternate',
        }}
      />
      {/* Dots on path */}
      {[
        [0, 58],
        [55, 32],
        [110, 18],
        [180, 4],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r='3.5'
          fill='#818cf8'
          style={{ animation: `sl-shimmer 1.5s ease ${i * 0.3}s infinite` }}
        />
      ))}
    </svg>
    <Label text='Loading reports…' color='#818cf8' />
    <Dots color='#818cf8' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   10. SETTINGS / DATA MANAGEMENT  ⚙️ — spinning gear
═══════════════════════════════════════════════════════════════════════════ */
export const SettingsLoader: FC = () => (
  <Wrap>
    <div style={{ position: 'relative', width: 60, height: 60 }}>
      {/* Outer ring */}
      <svg
        width='60'
        height='60'
        style={{
          position: 'absolute',
          inset: 0,
          animation: 'sl-spin 3s linear infinite',
        }}
      >
        <circle
          cx='30'
          cy='30'
          r='24'
          fill='none'
          stroke='rgba(148,163,184,.2)'
          strokeWidth='6'
        />
        <circle
          cx='30'
          cy='30'
          r='24'
          fill='none'
          stroke='rgba(148,163,184,.7)'
          strokeWidth='6'
          strokeLinecap='round'
          strokeDasharray={`${2 * Math.PI * 24 * 0.25} ${2 * Math.PI * 24 * 0.75}`}
        />
      </svg>
      {/* Inner ring reverse */}
      <svg
        width='60'
        height='60'
        style={{
          position: 'absolute',
          inset: 0,
          animation: 'sl-spin 2s linear reverse infinite',
        }}
      >
        <circle
          cx='30'
          cy='30'
          r='14'
          fill='none'
          stroke='rgba(99,102,241,.3)'
          strokeWidth='4'
        />
        <circle
          cx='30'
          cy='30'
          r='14'
          fill='none'
          stroke='#6366f1'
          strokeWidth='4'
          strokeLinecap='round'
          strokeDasharray={`${2 * Math.PI * 14 * 0.4} ${2 * Math.PI * 14 * 0.6}`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
      >
        ⚙️
      </div>
    </div>
    <Label text='Processing…' color='#94a3b8' />
    <Dots color='#94a3b8' />
  </Wrap>
);

/* ═══════════════════════════════════════════════════════════════════════════
   11. IMPORT / SYNC  📥 — bouncing download arrow
═══════════════════════════════════════════════════════════════════════════ */
export const ImportLoader: FC<{ label?: string }> = ({
  label = 'Importing…',
}) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <style>{BASE_CSS}</style>
    <div style={{ display: 'flex', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 3,
            height: 12,
            borderRadius: 2,
            background: '#6366f1',
            animation: `sl-bar 0.8s ease-in-out ${i * 0.15}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#94a3b8',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   12. INLINE small spinner — for button busy states
═══════════════════════════════════════════════════════════════════════════ */
export const SpinnerInline: FC<{ color?: string }> = ({
  color = '#94a3b8',
}) => (
  <>
    <style>{BASE_CSS}</style>
    <svg
      width='14'
      height='14'
      viewBox='0 0 14 14'
      style={{ animation: 'sl-spin 0.8s linear infinite', flexShrink: 0 }}
    >
      <circle
        cx='7'
        cy='7'
        r='5.5'
        fill='none'
        stroke={color}
        strokeWidth='2'
        strokeOpacity='0.25'
      />
      <path
        d='M7 1.5 A5.5 5.5 0 0 1 12.5 7'
        fill='none'
        stroke={color}
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  </>
);

/* ═══════════════════════════════════════════════════════════════════════════
   13. STOCK METADATA  — small inline asset count bar
═══════════════════════════════════════════════════════════════════════════ */
export const MetadataLoader: FC<{ count: number }> = ({ count }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    }}
  >
    <style>{BASE_CSS}</style>
    <div style={{ display: 'flex', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 4,
            height: 14,
            borderRadius: 2,
            background: '#10b981',
            animation: `sl-bar 1s ease-in-out ${i * 0.18}s infinite`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#10b981',
        letterSpacing: '0.03em',
      }}
    >
      Fetching {count} asset{count !== 1 ? 's' : ''}…
    </span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   14. NOTION SYNC  — pulsing cloud
═══════════════════════════════════════════════════════════════════════════ */
export const NotionSyncLoader: FC = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <style>{BASE_CSS}</style>
    <span
      style={{ fontSize: 16, animation: 'sl-wave 1.2s ease-in-out infinite' }}
    >
      ☁️
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
      Syncing to Notion…
    </span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT export — generic fallback
═══════════════════════════════════════════════════════════════════════════ */
export const SectionLoader: FC<{ label?: string }> = ({
  label = 'Loading…',
}) => (
  <Wrap>
    <div style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 32,
            borderRadius: 4,
            background: `rgba(99,102,241,${0.3 + i * 0.15})`,
            transformOrigin: 'bottom',
            animation: `sl-bar 0.9s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
    <Label text={label} color='#94a3b8' />
    <Dots color='#94a3b8' />
  </Wrap>
);
