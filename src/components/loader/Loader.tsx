// Drop-in replacement for the loading screen in App.tsx
// Paste this JSX where the old loader div was, or use as a standalone component.

export function Loader() {
    return (
      <div
        className="grid h-screen w-full place-items-center"
        style={{ background: "#020b18" }}
      >
        <style>{`
          @keyframes bar-grow {
            0%   { transform: scaleY(0.08); opacity: 0.25; }
            100% { transform: scaleY(1);    opacity: 1; }
          }
          @keyframes line-draw {
            0%   { stroke-dashoffset: 320; opacity: 0; }
            20%  { opacity: 1; }
            100% { stroke-dashoffset: 0;   opacity: 1; }
          }
          @keyframes dot-pop {
            0%, 80%  { transform: scale(0); opacity: 0; }
            90%      { transform: scale(1.4); opacity: 1; }
            100%     { transform: scale(1);   opacity: 1; }
          }
          @keyframes label-fade {
            0%   { opacity: 0; transform: translateY(6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes shimmer {
            0%   { background-position: -200% center; }
            100% { background-position:  200% center; }
          }
          @keyframes ticker-up {
            0%   { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
  
          .bar {
            transform-origin: bottom;
            animation: bar-grow 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          }
          .bar-1 { animation-delay: 0.00s; }
          .bar-2 { animation-delay: 0.08s; }
          .bar-3 { animation-delay: 0.16s; }
          .bar-4 { animation-delay: 0.24s; }
          .bar-5 { animation-delay: 0.32s; }
          .bar-6 { animation-delay: 0.40s; }
          .bar-7 { animation-delay: 0.48s; }
  
          .gain-line {
            stroke-dasharray: 320;
            stroke-dashoffset: 320;
            animation: line-draw 1.1s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
          }
          .gain-dot {
            animation: dot-pop 1.2s ease 1.1s both;
          }
          .loader-label {
            animation: label-fade 0.5s ease 1.0s both;
          }
          .shimmer-text {
            background: linear-gradient(
              90deg,
              #10b981 0%,
              #34d399 30%,
              #6ee7b7 50%,
              #34d399 70%,
              #10b981 100%
            );
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shimmer 2s linear 1s infinite;
          }
          .ticker {
            animation: ticker-up 0.4s ease 1.35s both;
          }
        `}</style>
  
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>
  
          {/* ── Chart visual ── */}
          <div style={{ position: "relative", width: 220, height: 120 }}>
  
            {/* Bar chart background */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              display: "flex", alignItems: "flex-end", gap: 6, height: 80, padding: "0 4px",
            }}>
              {[
                { h: 38, color: "rgba(16,185,129,0.18)" },
                { h: 28, color: "rgba(16,185,129,0.14)" },
                { h: 52, color: "rgba(16,185,129,0.18)" },
                { h: 40, color: "rgba(16,185,129,0.14)" },
                { h: 60, color: "rgba(16,185,129,0.20)" },
                { h: 55, color: "rgba(16,185,129,0.16)" },
                { h: 78, color: "rgba(16,185,129,0.28)" },
              ].map((bar, i) => (
                <div
                  key={i}
                  className={`bar bar-${i + 1}`}
                  style={{
                    flex: 1,
                    height: bar.h,
                    borderRadius: "4px 4px 0 0",
                    background: bar.color,
                    border: "1px solid rgba(16,185,129,0.25)",
                  }}
                />
              ))}
            </div>
  
            {/* Gain line on top */}
            <svg
              width="220" height="120"
              viewBox="0 0 220 120"
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
  
              {/* Area fill */}
              <path
                className="gain-line"
                d="M8,98 C30,90 50,80 70,68 C90,56 100,62 120,48 C140,34 158,38 175,22 L212,8 L212,110 L8,110 Z"
                fill="url(#areaGrad)"
                stroke="none"
                style={{ strokeDasharray: "none", strokeDashoffset: "unset", animation: "line-draw 1.1s cubic-bezier(0.4,0,0.2,1) 0.3s both" }}
              />
  
              {/* Gain line */}
              <path
                className="gain-line"
                d="M8,98 C30,90 50,80 70,68 C90,56 100,62 120,48 C140,34 158,38 175,22 L212,8"
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#glow)"
              />
  
              {/* Live dot at tip */}
              <circle
                className="gain-dot"
                cx="212" cy="8" r="4.5"
                fill="#34d399"
                filter="url(#glow)"
              />
              <circle cx="212" cy="8" r="8"
                fill="rgba(52,211,153,0.18)"
                className="gain-dot"
                style={{ animationDelay: "1.15s" }}
              />
            </svg>
  
            {/* +18.4% badge */}
            <div
              className="ticker"
              style={{
                position: "absolute", top: 0, right: 0,
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: 8, padding: "3px 8px",
                fontSize: 11, fontWeight: 700, color: "#34d399",
                letterSpacing: "0.02em",
              }}
            >
              ↑ +18.4%
            </div>
          </div>
  
          {/* ── Label ── */}
          <div className="loader-label" style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: 6,
            }}>
              <span style={{ color: "#f1f5f9" }}>Fin</span>
              <span className="shimmer-text">Trackly</span>
            </div>
            <div style={{
              fontSize: 12,
              color: "rgba(148,163,184,0.6)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Loading your portfolio…
            </div>
          </div>
  
        </div>
      </div>
    );
  }