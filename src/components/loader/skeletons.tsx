// src/components/loader/skeletons.tsx
// Section-specific skeleton loaders — shown while store is hydrating
// Premium animations applied to eliminate flicker and provide a high-end feel.

import React from 'react';

// ─── Shared Premium Primitives ───────────────────────────────────────────────

const PREMIUM_ANIMATIONS = `
@keyframes skShimmer {
  0%   { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
@keyframes skBreathe {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
@keyframes skFadeUp {
  0%   { opacity: 0; transform: translateY(12px) scale(0.98); filter: blur(3px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
`;

// Theme-aware via CSS variables (see index.css --sk-*)
const C_BG = 'var(--sk-bg)';
const C_BONE = 'var(--sk-bone)';
const C_SHIMMER = 'var(--sk-shimmer)';

function Bone({
  w = '100%',
  h = 14,
  r = 6,
  mb = 0,
  mt = 0,
  style = {},
}: {
  w?: string | number;
  h?: number;
  r?: number;
  mb?: number;
  mt?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        flexShrink: 0,
        backgroundColor: C_BONE,
        backgroundImage: `linear-gradient(to right, ${C_BONE} 0%, ${C_SHIMMER} 20%, ${C_BONE} 40%, ${C_BONE} 100%)`,
        backgroundSize: '2000px 100%',
        animation: 'skShimmer 2s infinite linear',
        marginBottom: mb,
        marginTop: mt,
        ...style,
      }}
    />
  );
}

function Card({
  children,
  accent,
  pad = '16px 18px',
  delay = 0,
  style = {},
}: {
  children: React.ReactNode;
  accent?: string;
  pad?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: accent ? `${accent}0A` : C_BG,
        borderRadius: 16,
        border: `1px solid ${accent ? `${accent}22` : 'rgba(255,255,255,0.03)'}`,
        boxShadow: accent
          ? `0 4px 20px -2px ${accent}08`
          : '0 4px 20px -2px rgba(0,0,0,0.2)',
        padding: pad,
        animation: `skFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  children,
  gap = 12,
  align = 'center',
  justify = 'flex-start',
  style = {},
}: {
  children: React.ReactNode;
  gap?: number;
  align?: string;
  justify?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap,
        alignItems: align,
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Col({
  children,
  gap = 8,
  style = {},
}: {
  children: React.ReactNode;
  gap?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  );
}

function Circle({
  size = 40,
  color = C_BONE,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: color !== C_BONE ? `0 0 10px ${color}30` : 'none',
      }}
    />
  );
}

function Avatar({ size = 44, color }: { size?: number; color: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        flexShrink: 0,
        background: `${color}20`,
        boxShadow: `inset 0 0 0 1px ${color}30`,
      }}
    />
  );
}

function Bar({
  pct,
  color,
  h = 5,
}: {
  pct: number;
  color: string;
  h?: number;
}) {
  return (
    <div
      style={{
        height: h,
        borderRadius: h,
        background: C_BONE,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: h,
          background: `linear-gradient(90deg, ${color}dd, ${color})`,
          animation: 'skBreathe 2s ease-in-out infinite',
          boxShadow: `0 0 8px ${color}50`,
        }}
      />
    </div>
  );
}

function Grid({
  cols,
  children,
  gap = 12,
}: {
  cols: number;
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
      }}
    >
      {children}
    </div>
  );
}

function MetricCard({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <Card delay={delay}>
      <Bone w={70} h={10} mb={10} />
      <Bone w='65%' h={24} mb={8} />
      <Row gap={6}>
        <Circle size={8} color={color} />
        <Bone w={50} h={10} />
      </Row>
    </Card>
  );
}

function PageHeader({
  color,
  titleW = 140,
  subtitleW = 220,
  hasButton = false,
}: {
  color: string;
  titleW?: number;
  subtitleW?: number;
  hasButton?: boolean;
}) {
  return (
    <Card accent={color} pad='16px 20px' delay={0}>
      <Row justify='space-between'>
        <Row gap={14}>
          <Avatar size={44} color={color} />
          <Col gap={6}>
            <Bone w={titleW} h={18} />
            <Bone w={subtitleW} h={12} />
          </Col>
        </Row>
        {hasButton && <Bone w={110} h={36} r={12} />}
      </Row>
    </Card>
  );
}

function TableRows({
  cols = 4,
  rows = 6,
  delay = 0.05,
}: {
  cols?: number;
  rows?: number;
  delay?: number;
}) {
  const colW = `${Math.floor(100 / cols)}%`;
  return (
    <>
      {Array(rows)
        .fill(0)
        .map((_, i) => (
          <Row
            key={i}
            gap={12}
            style={{
              padding: '13px 16px',
              borderBottom:
                i < rows - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              animation: `skFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * delay}s both`,
            }}
          >
            {Array(cols)
              .fill(0)
              .map((__, j) => (
                <Bone key={j} w={colW} h={13} />
              ))}
          </Row>
        ))}
    </>
  );
}

// Mini SVG chart used in multiple skeletons
function ChartSVG({
  color,
  height = 80,
  style = {},
}: {
  color: string;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width='100%'
      height={height}
      viewBox={`0 0 600 ${height}`}
      preserveAspectRatio='none'
      style={{ ...style, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}
    >
      <defs>
        <linearGradient
          id={`grad-${color.replace('#', '')}`}
          x1='0'
          y1='0'
          x2='0'
          y2='1'
        >
          <stop offset='0%' stopColor={color} stopOpacity='0.25' />
          <stop offset='100%' stopColor={color} stopOpacity='0' />
        </linearGradient>
      </defs>
      <path
        d={`M0,${height * 0.8} C80,${height * 0.65} 160,${height * 0.45} 240,${height * 0.38} C320,${height * 0.3} 400,${height * 0.42} 480,${height * 0.22} C540,${height * 0.1} 580,${height * 0.18} 600,${height * 0.08} L600,${height} L0,${height}Z`}
        fill={`url(#grad-${color.replace('#', '')})`}
        style={{ animation: 'skBreathe 3s ease-in-out infinite' }}
      />
      <path
        d={`M0,${height * 0.8} C80,${height * 0.65} 160,${height * 0.45} 240,${height * 0.38} C320,${height * 0.3} 400,${height * 0.42} 480,${height * 0.22} C540,${height * 0.1} 580,${height * 0.18} 600,${height * 0.08}`}
        fill='none'
        stroke={`${color}80`}
        strokeWidth='2.5'
        strokeLinecap='round'
      />
    </svg>
  );
}

// ─── Wrapper that injects CSS + Layout ───────────────────────────────────────
function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{PREMIUM_ANIMATIONS}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 40,
        }}
      >
        {children}
      </div>
    </>
  );
}

// ─── 1. DASHBOARD ─────────────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#10b981' titleW={120} subtitleW={260} />

      <Grid cols={3}>
        {['#10b981', '#3b82f6', '#f59e0b'].map((c, i) => (
          <MetricCard key={i} color={c} delay={0.05 + i * 0.05} />
        ))}
      </Grid>

      <Grid cols={2} gap={14}>
        <Card delay={0.15}>
          <Bone w={110} h={13} mb={18} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                border: `16px solid ${C_BONE}`,
                borderTopColor: '#10b981',
                borderRightColor: '#3b82f6',
                borderBottomColor: '#f59e0b',
                animation: 'skBreathe 2s ease-in-out infinite',
                boxShadow: '0 0 20px rgba(0,0,0,0.2)',
              }}
            />
          </div>
          {[
            ['#10b981', 70],
            ['#3b82f6', 55],
            ['#f59e0b', 40],
          ].map(([c, w], i) => (
            <Row key={i} gap={8} style={{ marginBottom: 8 }}>
              <Circle size={8} color={c as string} />
              <Bone w={`${w}%`} h={10} />
            </Row>
          ))}
        </Card>

        <Card delay={0.2}>
          <Bone w={100} h={13} mb={16} />
          <ChartSVG color='#3b82f6' height={110} />
          <Bone w='60%' h={10} mt={8} />
        </Card>
      </Grid>

      <Card delay={0.25}>
        <Row justify='space-between' style={{ marginBottom: 18 }}>
          <Bone w={160} h={14} />
          <Bone w={80} h={30} r={20} />
        </Row>
        <ChartSVG color='#10b981' height={90} />
      </Card>

      <Grid cols={2} gap={14}>
        {['#a78bfa', '#f87171'].map((c, i) => (
          <Card key={i} delay={0.3 + i * 0.05}>
            <Bone w={100} h={13} mb={14} />
            {Array(3)
              .fill(0)
              .map((_, j) => (
                <div key={j} style={{ marginBottom: 10 }}>
                  <Row justify='space-between' style={{ marginBottom: 5 }}>
                    <Bone w={110} h={11} />
                    <Bone w={40} h={11} />
                  </Row>
                  <Bar pct={[65, 40, 80][j]} color={c} />
                </div>
              ))}
          </Card>
        ))}
      </Grid>
    </SkeletonPage>
  );
}

// ─── 2. INVESTMENTS ───────────────────────────────────────────────────────────
export function InvestmentsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#3b82f6' titleW={160} subtitleW={240} hasButton />

      <Row
        gap={8}
        style={{ flexWrap: 'wrap', animation: 'skFadeUp 0.4s 0.05s both' }}
      >
        {[80, 120, 100, 95, 110, 90].map((w, i) => (
          <Bone key={i} w={w} h={34} r={20} />
        ))}
      </Row>

      <Grid cols={4} gap={10}>
        {['#10b981', '#3b82f6', '#f59e0b', '#ef4444'].map((c, i) => (
          <Card key={i} delay={0.1 + i * 0.05}>
            <Bone w={60} h={10} mb={8} />
            <Bone w='70%' h={22} mb={6} />
            <Row gap={5}>
              <Circle size={6} color={c} />
              <Bone w={45} h={10} />
            </Row>
          </Card>
        ))}
      </Grid>

      <Card pad='0' delay={0.25}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
        >
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Bone key={i} w='75%' h={11} />
            ))}
        </div>
        {Array(7)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: 12,
                padding: '13px 16px',
                borderBottom:
                  i < 6 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                animation: `skFadeUp 0.4s ${0.3 + i * 0.04}s both`,
              }}
            >
              <Row gap={10}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: C_BONE,
                    flexShrink: 0,
                  }}
                />
                <Col gap={5}>
                  <Bone w={90} h={12} />
                  <Bone w={60} h={10} />
                </Col>
              </Row>
              <Bone w={65} h={24} r={20} />
              <Bone w='70%' h={13} />
              <Bone w='70%' h={13} />
              <Row gap={5}>
                <Circle size={7} color={i % 3 === 2 ? '#ef4444' : '#10b981'} />
                <Bone w={50} h={13} />
              </Row>
            </div>
          ))}
      </Card>
    </SkeletonPage>
  );
}

// ─── 3. CASHFLOW ──────────────────────────────────────────────────────────────
export function CashflowSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#10b981' titleW={110} subtitleW={230} hasButton />

      <Row gap={8} style={{ animation: 'skFadeUp 0.4s 0.05s both' }}>
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <Bone key={i} w={62} h={34} r={20} />
          ))}
      </Row>

      <Grid cols={3}>
        {[
          ['#10b981', 'Income'],
          ['#ef4444', 'Expenses'],
          ['#3b82f6', 'Savings'],
        ].map(([c], i) => (
          <Card key={i} accent={c as string} delay={0.1 + i * 0.05}>
            <Row gap={6} style={{ marginBottom: 10 }}>
              <Circle size={8} color={c as string} />
              <Bone w={60} h={11} />
            </Row>
            <Bone w='60%' h={28} mb={6} />
            <Bone w={80} h={10} />
          </Card>
        ))}
      </Grid>

      <Card delay={0.2}>
        <Bone w={130} h={14} mb={20} />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            height: 100,
          }}
        >
          {[65, 82, 50, 92, 68, 58, 88, 74, 56, 84, 72, 66].map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: '4px 4px 0 0',
                background: i % 2 === 0 ? '#10b98128' : '#ef444428',
                animation: `skBreathe 2s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
        <Row gap={12} style={{ marginTop: 10 }}>
          {['Income', 'Expense'].map((_, i) => (
            <Row key={i} gap={6}>
              <Circle size={8} color={['#10b981', '#ef4444'][i]} />
              <Bone w={50} h={10} />
            </Row>
          ))}
        </Row>
      </Card>

      <Card pad='0' delay={0.25}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
        >
          <Bone w={130} h={13} />
        </div>
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <Row
              key={i}
              gap={12}
              style={{
                padding: '13px 16px',
                borderBottom:
                  i < 5 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                animation: `skFadeUp 0.4s ${0.3 + i * 0.05}s both`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: C_BONE,
                  flexShrink: 0,
                }}
              />
              <Col gap={5} style={{ flex: 1 }}>
                <Bone w={130} h={13} />
                <Bone w={80} h={10} />
              </Col>
              <Bone w={70} h={16} />
            </Row>
          ))}
      </Card>
    </SkeletonPage>
  );
}

// ─── 4. GOALS ────────────────────────────────────────────────────────────────
export function GoalsSkeleton() {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa'];
  return (
    <SkeletonPage>
      <PageHeader color='#a78bfa' titleW={90} subtitleW={200} hasButton />

      <Grid cols={2} gap={14}>
        {Array(4)
          .fill(0)
          .map((_, i) => {
            const c = colors[i];
            return (
              <Card key={i} accent={c} delay={0.05 + i * 0.05}>
                <Row gap={10} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: `${c}18`,
                      flexShrink: 0,
                    }}
                  />
                  <Col gap={5} style={{ flex: 1 }}>
                    <Bone w='70%' h={14} />
                    <Bone w='50%' h={10} />
                  </Col>
                </Row>
                <Bar pct={[65, 42, 88, 23][i]} color={c} h={6} />
                <Row justify='space-between' style={{ marginTop: 10 }}>
                  <Bone w={70} h={11} />
                  <Bone w={50} h={11} />
                </Row>
              </Card>
            );
          })}
      </Grid>

      <Card delay={0.25}>
        <Bone w={120} h={14} mb={16} />
        <Grid cols={3} gap={10}>
          {['#10b981', '#f59e0b', '#ef4444'].map((c, i) => (
            <div
              key={i}
              style={{
                background: `${c}10`,
                borderRadius: 10,
                padding: '14px',
                border: `1px solid ${c}22`,
              }}
            >
              <Circle size={8} color={c} />
              <Bone w='55%' h={22} mt={10} mb={6} />
              <Bone w='80%' h={10} />
            </div>
          ))}
        </Grid>
      </Card>
    </SkeletonPage>
  );
}

// ─── 5. ACCOUNTS ─────────────────────────────────────────────────────────────
export function AccountsSkeleton() {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa'];
  return (
    <SkeletonPage>
      <PageHeader color='#34d399' titleW={110} subtitleW={210} hasButton />

      <Card
        accent='#10b981'
        pad='28px'
        style={{ textAlign: 'center' }}
        delay={0.05}
      >
        <Bone w={110} h={12} mb={12} style={{ margin: '0 auto 12px' }} />
        <Bone w={200} h={36} mb={10} style={{ margin: '0 auto 10px' }} />
        <Bone w={100} h={11} style={{ margin: '0 auto' }} />
      </Card>

      {Array(4)
        .fill(0)
        .map((_, i) => (
          <Card key={i} delay={0.15 + i * 0.05}>
            <Row justify='space-between'>
              <Row gap={14}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${colors[i]}18`,
                    flexShrink: 0,
                  }}
                />
                <Col gap={6}>
                  <Bone w={120} h={14} />
                  <Bone w={80} h={11} />
                </Col>
              </Row>
              <Col gap={6} style={{ alignItems: 'flex-end' }}>
                <Bone w={90} h={18} />
                <Bone w={60} h={10} />
              </Col>
            </Row>
          </Card>
        ))}
    </SkeletonPage>
  );
}

// ─── 6. LIABILITIES ──────────────────────────────────────────────────────────
export function LiabilitiesSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#ef4444' titleW={120} subtitleW={210} hasButton />

      <Grid cols={3}>
        {['#ef4444', '#f59e0b', '#10b981'].map((c, i) => (
          <Card key={i} accent={c} delay={0.05 + i * 0.05}>
            <Bone w={80} h={10} mb={8} />
            <Bone w='65%' h={24} mb={8} />
            <Bar pct={[75, 45, 30][i]} color={c} />
          </Card>
        ))}
      </Grid>

      {Array(4)
        .fill(0)
        .map((_, i) => (
          <Card key={i} delay={0.2 + i * 0.05}>
            <Row justify='space-between' align='flex-start'>
              <Row gap={12} style={{ flex: 1, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(239,68,68,0.12)',
                    flexShrink: 0,
                  }}
                />
                <Col gap={6} style={{ flex: 1 }}>
                  <Bone w={140} h={14} />
                  <Bone w={90} h={10} />
                  <div style={{ marginTop: 4 }}>
                    <Bar pct={[70, 45, 82, 35][i]} color='#ef4444' />
                  </div>
                </Col>
              </Row>
              <Col gap={6} style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                <Bone w={90} h={18} />
                <Bone w={60} h={11} />
              </Col>
            </Row>
          </Card>
        ))}
    </SkeletonPage>
  );
}

// ─── 7. INSIGHTS ─────────────────────────────────────────────────────────────
export function InsightsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#f59e0b' titleW={100} subtitleW={220} hasButton />

      <Card accent='#f59e0b' pad='20px' delay={0.05}>
        <Row gap={10} style={{ marginBottom: 14 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#f59e0b',
              animation: 'skBreathe 1s ease-in-out infinite',
              boxShadow: '0 0 10px #f59e0b60',
            }}
          />
          <Bone w={170} h={13} />
        </Row>
        {[100, 92, 82, 68].map((w, i) => (
          <Bone key={i} w={`${w}%`} h={12} mb={9} />
        ))}
      </Card>

      {[
        ['#10b981', 'Portfolio Health'],
        ['#3b82f6', 'Diversification'],
        ['#f59e0b', 'Risk Analysis'],
        ['#a78bfa', 'Recommendations'],
      ].map(([c], i) => (
        <Card key={i} accent={c as string} delay={0.15 + i * 0.05}>
          <Row gap={12} align='flex-start'>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${c}18`,
                flexShrink: 0,
              }}
            />
            <Col gap={8} style={{ flex: 1 }}>
              <Bone w={130} h={14} />
              <Bone w='100%' h={11} />
              <Bone w='88%' h={11} />
              <Bone w='65%' h={11} />
            </Col>
          </Row>
        </Card>
      ))}
    </SkeletonPage>
  );
}

// ─── 8. REPORTS ──────────────────────────────────────────────────────────────
export function ReportsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#3b82f6' titleW={100} subtitleW={210} hasButton />

      <Grid cols={4} gap={10}>
        {['#10b981', '#3b82f6', '#f59e0b', '#a78bfa'].map((_, i) => (
          <MetricCard key={i} color={_} delay={0.05 + i * 0.05} />
        ))}
      </Grid>

      <Card delay={0.25}>
        <Row justify='space-between' style={{ marginBottom: 20 }}>
          <Bone w={170} h={14} />
          <Row gap={8}>
            {['Monthly', 'Quarterly', 'Yearly'].map((_, i) => (
              <Bone key={i} w={72} h={30} r={20} />
            ))}
          </Row>
        </Row>
        <svg width='100%' height='120' viewBox='0 0 576 120'>
          {Array(12)
            .fill(0)
            .map((_, i) => {
              const h = [60, 80, 50, 95, 70, 85, 55, 90, 75, 65, 88, 72][i];
              return (
                <rect
                  key={i}
                  x={i * 46 + 4}
                  y={120 - h}
                  width={38}
                  height={h}
                  rx='5'
                  fill={i % 3 === 1 ? '#3b82f622' : '#10b98122'}
                  style={{
                    animation: `skBreathe 2s ease-in-out ${i * 0.05}s infinite`,
                  }}
                />
              );
            })}
        </svg>
      </Card>

      <Card delay={0.3}>
        <Bone w={130} h={14} mb={16} />
        <ChartSVG color='#a78bfa' height={80} />
      </Card>

      <Card pad='0' delay={0.35}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
        >
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Bone key={i} w='80%' h={11} />
            ))}
        </div>
        <TableRows cols={4} rows={5} delay={0.05} />
      </Card>
    </SkeletonPage>
  );
}

// ─── 9. SNAPSHOTS ────────────────────────────────────────────────────────────
export function SnapshotsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#10b981' titleW={110} subtitleW={200} hasButton />

      <Card delay={0.05}>
        <Bone w={160} h={14} mb={18} />
        <ChartSVG color='#10b981' height={100} />
      </Card>

      <Grid cols={2} gap={14}>
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <Card key={i} delay={0.15 + i * 0.05}>
              <Row justify='space-between' style={{ marginBottom: 12 }}>
                <Row gap={6}>
                  <Circle size={8} color='#10b981' />
                  <Bone w={80} h={11} />
                </Row>
                <Bone w={50} h={11} />
              </Row>
              <Bone w='70%' h={22} mb={10} />
              <Bar pct={[68, 54, 82, 45][i]} color='#10b981' h={4} />
              <Row justify='space-between' style={{ marginTop: 10 }}>
                <Bone w={70} h={10} />
                <Bone w={50} h={10} />
              </Row>
            </Card>
          ))}
      </Grid>
    </SkeletonPage>
  );
}

// ─── 10. SETTINGS ────────────────────────────────────────────────────────────
export function SettingsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#64748b' titleW={100} subtitleW={180} />

      {['Profile', 'Notifications', 'Integrations', 'Data & Privacy'].map(
        (_, gi) => (
          <Card key={gi} delay={0.05 + gi * 0.08}>
            <Bone w={130} h={13} mb={16} />
            {Array(3)
              .fill(0)
              .map((__, i) => (
                <Row
                  key={i}
                  justify='space-between'
                  style={{
                    padding: '12px 0',
                    borderBottom:
                      i < 2 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  }}
                >
                  <Row gap={12}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: C_BONE,
                        flexShrink: 0,
                      }}
                    />
                    <Col gap={5}>
                      <Bone w={120} h={13} />
                      <Bone w={170} h={10} />
                    </Col>
                  </Row>
                  <div
                    style={{
                      width: 42,
                      height: 22,
                      borderRadius: 11,
                      background: i === 0 ? '#10b98135' : C_BONE,
                      flexShrink: 0,
                    }}
                  />
                </Row>
              ))}
          </Card>
        ),
      )}
    </SkeletonPage>
  );
}

// ─── 11. TOOLS ───────────────────────────────────────────────────────────────
export function ToolsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#a78bfa' titleW={80} subtitleW={200} />

      <Grid cols={2} gap={14}>
        {['#a78bfa', '#10b981', '#3b82f6', '#f59e0b', '#f87171', '#34d399'].map(
          (c, i) => (
            <Card key={i} accent={c} delay={0.05 + i * 0.05}>
              <Row gap={12} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${c}18`,
                    flexShrink: 0,
                  }}
                />
                <Col gap={5}>
                  <Bone w={110} h={14} />
                  <Bone w={80} h={10} />
                </Col>
              </Row>
              <Bone w='90%' h={11} mb={6} />
              <Bone w='70%' h={11} />
            </Card>
          ),
        )}
      </Grid>
    </SkeletonPage>
  );
}

// ─── 13. PROFITS ─────────────────────────────────────────────────────────────
export function ProfitsSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#10b981' titleW={150} subtitleW={230} hasButton />

      <Grid cols={4}>
        {['#10b981', '#6366f1', '#f59e0b', '#3b82f6'].map((c, i) => (
          <Card key={i} accent={c} delay={0.05 + i * 0.05}>
            <Bone w={80} h={10} mb={8} />
            <Bone w='65%' h={24} mb={6} />
            <Bone w={70} h={10} />
          </Card>
        ))}
      </Grid>

      {Array(5)
        .fill(0)
        .map((_, i) => (
          <Card key={i} delay={0.25 + i * 0.07}>
            <Row justify='space-between'>
              <Row gap={12}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(16,185,129,0.12)',
                    flexShrink: 0,
                  }}
                />
                <Col gap={6}>
                  <Bone w={140} h={14} />
                  <Bone w={90} h={10} />
                </Col>
              </Row>
              <Col gap={6} style={{ alignItems: 'flex-end' }}>
                <Bone w={90} h={16} />
                <Bone w={60} h={11} />
              </Col>
            </Row>
          </Card>
        ))}
    </SkeletonPage>
  );
}

// ─── 12. AGRICULTURE ─────────────────────────────────────────────────────────
export function AgricultureSkeleton() {
  return (
    <SkeletonPage>
      <PageHeader color='#4ade80' titleW={130} subtitleW={210} hasButton />

      <Grid cols={3}>
        {['#4ade80', '#86efac', '#a3e635'].map((c, i) => (
          <Card key={i} accent={c} delay={0.05 + i * 0.05}>
            <Bone w={80} h={10} mb={8} />
            <Bone w='65%' h={24} mb={6} />
            <Bone w={70} h={10} />
          </Card>
        ))}
      </Grid>

      {Array(3)
        .fill(0)
        .map((_, i) => (
          <Card key={i} delay={0.2 + i * 0.08}>
            <Row justify='space-between'>
              <Row gap={12}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(74,222,128,0.12)',
                    flexShrink: 0,
                  }}
                />
                <Col gap={6}>
                  <Bone w={130} h={14} />
                  <Bone w={90} h={10} />
                  <Bone w={70} h={10} />
                </Col>
              </Row>
              <Col gap={6} style={{ alignItems: 'flex-end' }}>
                <Bone w={80} h={18} />
                <Bone w={60} h={11} />
              </Col>
            </Row>
          </Card>
        ))}
    </SkeletonPage>
  );
}
