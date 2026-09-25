// src/components/essentials/EssentialsHealthCards.tsx
//
// Auto-generated financial health check — Overall Health Score banner plus
// Emergency Fund · Savings Rate · Term Insurance · Health Insurance · Debt
// Ratio cards. Everything is DERIVED from the shared Financial Profile
// (`essentials`) + live linked accounts / investments / liabilities /
// insurance policies, so saving the profile recalculates all cards at once.
// Only cards with relevant data are rendered — profile details themselves are
// NOT repeated here (they live in the Financial Profile form above).

import {
  FiActivity,
  FiArrowUpRight,
  FiCreditCard,
  FiHeart,
  FiMaximize2,
  FiSave,
  FiShield,
  FiTrendingUp,
  FiUmbrella,
} from 'react-icons/fi';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { EssentialsStatus, PolicyView } from '../../utils/financialProfile';
import { NumericInput } from '../ui/NumericInput';
import { EssentialsStatusBadge } from './EssentialsStatusBadge';
import {
  EssentialsDetailModal,
  type EssentialsDetailKind,
} from './EssentialsDetailModal';
import { calcEssentialsHealth } from '../../utils/financialProfile';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Small shared bits ───────────────────────────────────────────────────────

const StatusBadge = EssentialsStatusBadge;

function CardShell({
  icon,
  iconCls,
  title,
  subtitle,
  status,
  onExpand,
  children,
}: {
  icon: React.ReactNode;
  iconCls: string;
  title: string;
  subtitle?: string;
  status: EssentialsStatus;
  onExpand?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className='group flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-5 sm:p-6 shadow-sm'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <span className={`text-lg ${iconCls}`}>{icon}</span>
          <div className='min-w-0'>
            <h3 className='truncate text-base font-bold text-slate-900 dark:text-slate-100'>
              {title}
            </h3>
            {subtitle && (
              <p className='text-[11px] text-slate-500 dark:text-slate-400'>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          <StatusBadge status={status} />
          {onExpand && (
            <button
              type='button'
              title='Expand details'
              aria-label={`Expand ${title} details`}
              onClick={onExpand}
              className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40'
            >
              <FiMaximize2 className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Compact synced policy rows (Insurance feature is the source of truth). */
function PolicyMiniList({ policies }: { policies: PolicyView[] }) {
  const navigate = useNavigate();
  if (policies.length === 0) return null;
  const expired = policies.filter((p) => p.status === 'expired').length;
  return (
    <div className='flex flex-col gap-1.5 rounded-xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 px-3 py-2.5'>
      {policies.slice(0, 3).map((p) => (
        <div key={p.id} className='flex items-center justify-between gap-2'>
          <span className='flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200'>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                p.status === 'active'
                  ? 'bg-emerald-500'
                  : p.status === 'expiring'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
            />
            <span className='truncate'>{p.policyName}</span>
          </span>
          <span className='shrink-0 text-[12px] font-bold tabular-nums text-slate-900 dark:text-slate-100'>
            {formatINR(p.coverageAmount)}
          </span>
        </div>
      ))}
      {policies.length > 3 && (
        <p className='text-[11px] text-slate-500 dark:text-slate-400'>
          +{policies.length - 3} more policy{policies.length - 3 !== 1 ? 's' : ''}
        </p>
      )}
      {expired > 0 && (
        <p className='text-[11px] font-semibold text-rose-600 dark:text-rose-400'>
          {expired} expired policy{expired !== 1 ? 's' : ''} excluded from cover —
          renew on the Insurance page.
        </p>
      )}
      <button
        type='button'
        onClick={() => navigate('/insurance')}
        className='self-start text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors'
      >
        Synced from Insurance · manage →
      </button>
    </div>
  );
}

function KeyValue({
  label,
  value,
  sub,
  right,
}: {
  label: string;
  value: string;
  sub?: string;
  right?: boolean;
}) {
  return (
    <div className={right ? 'text-right' : ''}>
      <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
        {label}
      </p>
      <p className='mt-0.5 text-base font-black tabular-nums text-slate-900 dark:text-slate-100'>
        {value}
      </p>
      {sub && (
        <p className='text-[11px] text-slate-500 dark:text-slate-400'>{sub}</p>
      )}
    </div>
  );
}

function ScaleBar({
  pct,
  marks,
}: {
  pct: number; // 0–100
  marks: string[];
}) {
  const color =
    pct >= 66 ? 'bg-emerald-600' : pct >= 33 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className='h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <div className='mt-1 flex justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-400'>
        {marks.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20';

// ── Main component ──────────────────────────────────────────────────────────

export function EssentialsHealthCards() {
  const navigate = useNavigate();
  const essentials = usePortfolioStore((s) => s.essentials);
  const accounts = usePortfolioStore((s) => s.accounts);
  const investments = usePortfolioStore((s) => s.investments);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const insurancePolicies = usePortfolioStore((s) => s.insurancePolicies);
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const setEssentialsConfig = usePortfolioStore((s) => s.setEssentialsConfig);

  const health = useMemo(
    () =>
      calcEssentialsHealth({
        essentials,
        accounts,
        investments,
        liabilities,
        insurancePolicies,
        pendingPayments,
        cashflows,
      }),
    [essentials, accounts, investments, liabilities, insurancePolicies, pendingPayments, cashflows],
  );

  // ── Relevance gating: only show a card when it has meaningful data ──
  const showSavings = health.hasProfile;
  const showTerm =
    insurancePolicies.some((p) => p.type === 'life') || health.hasProfile;
  const showHealthIns =
    insurancePolicies.some((p) => p.type === 'health') || health.hasProfile;
  const showDebt =
    health.debt.totalAssets > 0 || health.debt.totalLiabilities > 0;

  // Local edits for emergency-fund config + dependents (saved to essentials)
  const [efTarget, setEfTarget] = useState<string | null>(null);
  const [efExtra, setEfExtra] = useState<string | null>(null);
  const [dependents, setDependents] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<EssentialsDetailKind | null>(null);

  const targetVal =
    efTarget ?? String(essentials?.emergencyFundTarget || 0);
  const extraVal =
    efExtra ?? String(essentials?.emergencyFundCurrent || 0);
  const dependentsVal = dependents ?? String(essentials?.dependents || 0);

  const saveEssentials = async () => {
    setSaving(true);
    try {
      await setEssentialsConfig({
        emergencyFundTarget: Number(targetVal) || 0,
        emergencyFundCurrent: Number(extraVal) || 0,
        // Dependents is a people-count (0–20); clamp so typos like 100000
        // can't blow up the recommended-cover formula.
        dependents: Math.max(0, Math.min(20, Math.round(Number(dependentsVal) || 0))),
      });
    } finally {
      setSaving(false);
    }
  };

  const scorePct = (health.overall / 10) * 100;

  return (
    <div className='flex flex-col gap-5'>
      {/* ── Overall Health Score banner ── */}
      <div className='flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-5 sm:p-6 shadow-sm sm:flex-row sm:items-center sm:gap-6'>
        <div className='flex items-baseline gap-1 shrink-0'>
          <span className='text-4xl font-black tabular-nums text-slate-900 dark:text-slate-50'>
            {health.overall.toFixed(1)}
          </span>
          <span className='text-sm font-bold text-slate-400'>/10</span>
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
            Overall Health Score
          </p>
          <div className='mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                scorePct >= 60
                  ? 'bg-emerald-700 dark:bg-emerald-500'
                  : scorePct >= 40
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              style={{ width: `${scorePct}%` }}
            />
          </div>
        </div>
        <span
          className={`shrink-0 text-sm font-bold ${
            health.overall >= 6
              ? 'text-emerald-600 dark:text-emerald-400'
              : health.overall >= 4
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {health.overallLabel}
        </span>
      </div>

      <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
        {/* ── Emergency Fund ── */}
        <CardShell
          icon={<FiShield />}
          iconCls='text-blue-500'
          title='Emergency Fund'
          status={health.emergency.status}
          onExpand={() => setExpanded('emergency')}
        >
          <div className='flex items-end justify-between gap-4'>
            <KeyValue
              label='Liquid Assets'
              value={formatINR(health.liquid.total)}
              sub='Cash & Savings · FD & RD · linked accounts'
            />
            <KeyValue
              label='Runway'
              value={`${Math.round(health.emergency.runwayMonths)} months`}
              right
            />
          </div>
          <ScaleBar
            pct={(Math.min(health.emergency.runwayMonths, 12) / 12) * 100}
            marks={['0', '3m', '6m', '12m+']}
          />
          <p className='text-sm text-slate-600 dark:text-slate-300'>
            {health.emergency.status === 'Perfect'
              ? 'Excellent! Your emergency fund is well-stocked.'
              : health.emergency.status === 'Good'
                ? 'Decent runway — aim for 6+ months of expenses.'
                : 'Low runway — build 3–6 months of expenses as liquid assets.'}
          </p>
          {/* Config carried over from the old Settings → Essentials tab */}
          <div className='grid gap-3 sm:grid-cols-2 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
            <div>
              <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                Target (₹)
                {health.monthlyExpense > 0 && (
                  <span className='ml-1 normal-case font-semibold text-slate-400'>
                    · rec. {formatINR(health.monthlyExpense * 6)}
                  </span>
                )}
              </label>
              <NumericInput
                className={inputCls}
                value={targetVal}
                onChange={setEfTarget}
              />
            </div>
            <div>
              <label className='block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                Extra EF Savings (₹)
              </label>
              <NumericInput
                className={inputCls}
                value={extraVal}
                onChange={setEfExtra}
              />
            </div>
          </div>
          <div className='flex items-center justify-end'>
            <button
              type='button'
              onClick={() => void saveEssentials()}
              disabled={saving}
              className='inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors'
            >
              <FiSave className='h-3.5 w-3.5' /> Save
            </button>
          </div>
        </CardShell>

        {/* ── Savings Rate (only once a Financial Profile exists) ── */}
        {showSavings && (
        <CardShell
          icon={<FiTrendingUp />}
          iconCls='text-amber-500'
          title='Savings Rate'
          status={health.savings.status}
          onExpand={() => setExpanded('savings')}
        >
          <div className='flex items-baseline gap-2'>
            <span className='text-4xl font-black tabular-nums text-emerald-700 dark:text-emerald-400'>
              {Math.round(health.savings.rate)}%
            </span>
            <span className='text-sm font-semibold text-slate-600 dark:text-slate-300'>
              of income saved · {formatINR(health.monthlySavings)}/mo
            </span>
          </div>
          <ScaleBar
            pct={(Math.min(health.savings.rate, 80) / 80) * 100}
            marks={['0%', '20%', '50%', '80%+']}
          />
          <div className='flex items-center justify-between gap-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 px-4 py-3'>
            <span className='text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
              Time to Financial Independence
            </span>
            <span className='text-sm font-black text-slate-900 dark:text-slate-100'>
              {health.savings.fiYears == null
                ? health.hasProfile
                  ? '50+ yrs'
                  : '—'
                : `around ${health.savings.fiYears} yrs`}
            </span>
          </div>
          <p className='text-sm text-slate-600 dark:text-slate-300'>
            {health.savings.status === 'Perfect'
              ? "Outstanding! You're on a fast track to financial freedom."
              : health.savings.status === 'Good'
                ? 'Healthy savings rate — keep it above 20%.'
                : 'Thin margins — try to save at least 20% of income.'}
          </p>
        </CardShell>
        )}

        {/* ── Term Insurance ── */}
        {showTerm && (
        <CardShell
          icon={<FiUmbrella />}
          iconCls='text-indigo-500'
          title='Term Insurance'
          status={health.term.status}
          onExpand={() => setExpanded('term')}
        >
          <div className='grid grid-cols-2 gap-4'>
            <KeyValue label='Your Cover' value={formatINR(health.term.cover)} />
            <KeyValue
              label='Ideal Cover'
              value={
                health.term.recommended > 0
                  ? formatINR(health.term.recommended)
                  : '—'
              }
              sub={
                health.term.formula === 'expense25'
                  ? '25× annual expense − net worth'
                  : health.term.formula === 'income10'
                    ? '10× annual income'
                    : 'set income in profile'
              }
              right
            />
          </div>
          <PolicyMiniList policies={health.term.policies} />
          <button
            type='button'
            onClick={() => navigate('/insurance')}
            className='flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-400 transition-colors'
          >
            Manage policies on Insurance page <FiArrowUpRight className='h-3.5 w-3.5' />
          </button>
          <p className='text-sm text-slate-600 dark:text-slate-300'>
            {health.term.status === 'Perfect'
              ? 'Well protected — your dependents are financially secure.'
              : health.term.status === 'Good'
                ? 'Partial cover — consider topping up to 10× annual income.'
                : 'No adequate term cover — the biggest protection gap.'}
          </p>
        </CardShell>
        )}

        {/* ── Health Insurance ── */}
        {showHealthIns && (
        <CardShell
          icon={<FiHeart />}
          iconCls='text-rose-500'
          title='Health Insurance'
          status={health.health.status}
          onExpand={() => setExpanded('health')}
        >
          <div className='flex items-center gap-3'>
            <div className='flex flex-col gap-0.5'>
              <label className='text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
                Dependents
              </label>
              <span className='text-[10px] font-medium text-slate-400 dark:text-slate-400'>
                people who rely on your income (0–20)
              </span>
            </div>
            <div className='w-20'>
              <input
                type='number'
                min={0}
                max={20}
                step={1}
                inputMode='numeric'
                className={inputCls}
                value={dependentsVal}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  const n = Math.max(0, Math.min(20, Number(raw) || 0));
                  setDependents(raw === '' ? '' : String(n));
                }}
              />
            </div>
            <button
              type='button'
              onClick={() => void saveEssentials()}
              disabled={saving}
              className='inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors'
            >
              <FiSave className='h-3.5 w-3.5' /> Save
            </button>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <KeyValue
              label='Your Cover'
              value={formatINR(health.health.cover)}
              sub={`${health.health.policies.filter((p) => p.status !== 'expired').length} active polic${health.health.policies.filter((p) => p.status !== 'expired').length === 1 ? 'y' : 'ies'}`}
            />
            <KeyValue
              label='Recommended'
              value={`Min ${formatINR(health.health.minRecommended)}`}
              sub={`Good ${formatINR(health.health.recommended)}`}
              right
            />
          </div>
          <PolicyMiniList policies={health.health.policies} />
          <button
            type='button'
            onClick={() => navigate('/insurance')}
            className='flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-400 transition-colors'
          >
            Manage policies on Insurance page <FiArrowUpRight className='h-3.5 w-3.5' />
          </button>
          <p className='text-sm text-slate-600 dark:text-slate-300'>
            {health.health.status === 'Perfect'
              ? "Medical shocks won't derail your plans."
              : health.health.status === 'Good'
                ? 'Basic cover in place — consider ₹5L+ for the family.'
                : 'No health cover — one hospitalisation can wipe out savings.'}
          </p>
        </CardShell>
        )}

        {/* ── Debt Ratio ── */}
        {showDebt && (
        <CardShell
          icon={<FiCreditCard />}
          iconCls='text-rose-400'
          title='Debt Ratio'
          subtitle='liabilities ÷ total assets'
          status={health.debt.status}
          onExpand={() => setExpanded('debt')}
        >
          <div className='flex items-baseline gap-2'>
            <span className='text-4xl font-black tabular-nums text-slate-900 dark:text-slate-50'>
              {(health.debt.ratio * 100).toFixed(1)}%
            </span>
            <span className='text-sm font-semibold text-slate-600 dark:text-slate-300'>
              of assets funded by debt
            </span>
          </div>
          <ScaleBar
            pct={health.debt.ratio * 100}
            marks={['0%', '20%', '40%', '60%+']}
          />
          <div className='grid grid-cols-2 gap-4'>
            <KeyValue
              label='Total Liabilities'
              value={formatINR(health.debt.totalLiabilities)}
            />
            <KeyValue
              label='Total Assets'
              value={formatINR(health.debt.totalAssets)}
              right
            />
          </div>
          <p className='text-sm text-slate-600 dark:text-slate-300'>
            {health.debt.status === 'Perfect'
              ? 'Healthy balance sheet — debts are well under control.'
              : health.debt.status === 'Good'
                ? 'Manageable debt — avoid adding high-interest debt.'
                : 'Debt-heavy — prioritise paying down high-interest loans.'}
          </p>
        </CardShell>
        )}

        {/* ── Quick activity pointer ── */}
        <div className='flex flex-col justify-center gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20 p-6'>
          <FiActivity className='h-5 w-5 text-emerald-500' />
          <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
            Scores update automatically
          </p>
          <p className='text-xs text-slate-500 dark:text-slate-400'>
            Liquid assets are pulled live from your linked accounts and FD/RD
            holdings; insurance covers from your policies; debts from your
            liabilities. Only the Financial Profile above is typed by hand.
            {!health.hasProfile &&
              ' Add your Financial Profile to unlock the savings and insurance checks.'}
          </p>
        </div>
      </div>

      {/* ── Expand-detail modal (hover ⤢ on any card) ── */}
      <EssentialsDetailModal
        kind={expanded}
        onClose={() => setExpanded(null)}
        health={health}
        accounts={accounts}
        investments={investments}
        cashflows={cashflows}
      />
    </div>
  );
}
