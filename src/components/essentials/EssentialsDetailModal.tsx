// src/components/essentials/EssentialsDetailModal.tsx
//
// Expand-detail view for each Essentials health card. Opened from the hover
// Expand icon on the card. Everything shown here is DERIVED live from the
// same sources the cards use (Financial Profile, linked accounts,
// investments, liabilities and — for the insurance sections — the Insurance
// feature's policy list), so nothing is duplicated or stored twice.

import { FiArrowUpRight, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import type { Account, CashflowEntry, Investment } from '../../types/investmentTypes';
import { Modal } from '../ui/Modal';
import { EssentialsStatusBadge } from './EssentialsStatusBadge';
import { calcLiveAccountBalances } from '../../utils/calculations';
import { formatINR } from '../../utils/format';
import {
  monthsToFinancialIndependence,
  type EssentialsHealth,
  type PolicyView,
} from '../../utils/financialProfile';

export type EssentialsDetailKind =
  | 'emergency'
  | 'savings'
  | 'term'
  | 'health'
  | 'debt';

const KIND_META: Record<EssentialsDetailKind, { title: string; emoji: string }> = {
  emergency: { title: 'Emergency Fund', emoji: '🛡️' },
  savings: { title: 'Savings Rate', emoji: '💰' },
  term: { title: 'Term Insurance', emoji: '📋' },
  health: { title: 'Health Insurance', emoji: '💊' },
  debt: { title: 'Debt Ratio', emoji: '⚖️' },
};

// ── Layout primitives ───────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className='text-sm font-bold text-slate-900 dark:text-slate-100'>
      {children}
    </h4>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-xl bg-slate-100 dark:bg-slate-800/60 px-4 py-3'>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className='flex items-center justify-between gap-4 py-1.5'>
      <span
        className={`text-sm ${strong ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${
          tone === 'good'
            ? 'font-bold text-emerald-700 dark:text-emerald-400'
            : tone === 'bad'
              ? 'font-bold text-rose-600 dark:text-rose-400'
              : strong
                ? 'font-bold text-slate-900 dark:text-slate-100'
                : 'font-semibold text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className='h-px w-full bg-slate-200 dark:bg-slate-800' />;
}

function Tips({ items }: { items: string[] }) {
  return (
    <ul className='flex flex-col gap-1.5'>
      {items.map((t) => (
        <li
          key={t}
          className='flex gap-2 text-[13px] text-slate-600 dark:text-slate-300'
        >
          <span className='shrink-0'>•</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Banner({ tone, title, sub }: { tone: 'good' | 'warn' | 'bad'; title: string; sub: string }) {
  const cls =
    tone === 'good'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400';
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${cls}`}>
      <p className='text-sm font-bold'>{title}</p>
      <p className='mt-0.5 text-[13px] opacity-90'>{sub}</p>
    </div>
  );
}

function StatusChip({ status }: { status: PolicyView['status'] }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
      : status === 'expiring'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
  const label =
    status === 'active' ? 'Active' : status === 'expiring' ? 'Expiring ≤30d' : 'Expired';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

/** Live-synced policy list — straight from the Insurance feature. */
function PolicyTable({
  policies,
  emptyLabel,
}: {
  policies: PolicyView[];
  emptyLabel: string;
}) {
  const navigate = useNavigate();
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-3'>
        <SectionTitle>Your policies (synced from Insurance)</SectionTitle>
        <button
          type='button'
          onClick={() => navigate('/insurance')}
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors'
        >
          <FiRefreshCw className='h-3 w-3' /> Manage <FiArrowUpRight className='h-3 w-3' />
        </button>
      </div>
      {policies.length === 0 ? (
        <p className='rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-[13px] text-slate-500 dark:text-slate-400'>
          {emptyLabel}
        </p>
      ) : (
        <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800'>
          {policies.map((p, i) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${i > 0 ? 'border-t border-slate-200 dark:border-slate-800' : ''} ${p.status === 'expired' ? 'opacity-60' : ''}`}
            >
              <div className='min-w-0 flex-1'>
                <p className='truncate text-[13px] font-bold text-slate-900 dark:text-slate-100'>
                  {p.policyName}
                </p>
                <p className='truncate text-[11px] text-slate-500 dark:text-slate-400'>
                  {p.provider} · renews {p.renewalDate || '—'}
                </p>
              </div>
              <div className='flex items-center gap-3 shrink-0'>
                <div className='text-right'>
                  <p className='text-[13px] font-bold tabular-nums text-slate-900 dark:text-slate-100'>
                    {formatINR(p.coverageAmount)}
                  </p>
                  <p className='text-[11px] tabular-nums text-slate-500 dark:text-slate-400'>
                    {formatINR(p.premiumAmount)}/{p.premiumFrequency.replace('ly', '').replace('half-year', '6m')}
                  </p>
                </div>
                <StatusChip status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-card detail bodies ──────────────────────────────────────────────────

function EmergencyDetail({
  health,
  accounts,
  investments,
  cashflows,
}: {
  health: EssentialsHealth;
  accounts: Account[];
  investments: Investment[];
  cashflows: CashflowEntry[];
}) {
  const navigate = useNavigate();
  const live = calcLiveAccountBalances(accounts, cashflows);
  const bankRows = accounts
    .filter((a) => a.type === 'bank')
    .map((a) => ({ name: a.name, value: live[a.id] ?? a.balance ?? 0 }));
  const fdRows = investments
    .filter((i) => i.type === 'fixed_deposit')
    .map((i) => ({ name: i.name, value: (i as any).investedAmount || 0 }));
  const holdings = [...bankRows, ...fdRows];
  const me = health.monthlyExpense;

  return (
    <div className='flex flex-col gap-4'>
      <Block>
        <Row label='Monthly expense' value={me > 0 ? formatINR(me) : '—'} />
        <Row label='3-month target' value={me > 0 ? formatINR(me * 3) : '—'} />
        <Row label='6-month target' value={me > 0 ? formatINR(me * 6) : '—'} />
        <Row label='12-month target' value={me > 0 ? formatINR(me * 12) : '—'} />
        <Divider />
        <Row label='Cash & Savings (live accounts)' value={formatINR(health.liquid.cashSavings)} />
        <Row label='FD & RD' value={formatINR(health.liquid.fdRd)} />
        {health.liquid.extra > 0 && (
          <Row label='Extra EF savings' value={formatINR(health.liquid.extra)} />
        )}
        <Row label='Total liquid' value={formatINR(health.liquid.total)} strong tone='good' />
      </Block>

      {health.emergency.status === 'Perfect' ? (
        <Banner
          tone='good'
          title='🎉 Excellent emergency fund!'
          sub='You have 12+ months of expenses covered. Your financial safety net is rock solid.'
        />
      ) : health.emergency.status === 'Good' ? (
        <Banner
          tone='warn'
          title='Decent runway'
          sub='Aim for 6+ months of expenses in liquid assets to ride out any shock.'
        />
      ) : (
        <Banner
          tone='bad'
          title='Low runway'
          sub='Build 3–6 months of expenses as liquid assets before investing aggressively.'
        />
      )}

      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-3'>
          <SectionTitle>Choose assets</SectionTitle>
          <span className='inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400'>
            <FiRefreshCw className='h-3 w-3' /> Auto-detected
          </span>
        </div>
        <Block>
          {holdings.length === 0 ? (
            <p className='py-1 text-[13px] text-slate-500 dark:text-slate-400'>
              No liquid holdings yet — add a bank account or an FD to auto-detect.
            </p>
          ) : (
            <>
              <p className='pb-1 text-[13px] font-bold text-slate-900 dark:text-slate-100'>
                Auto-detected from {holdings.length} liquid holding
                {holdings.length !== 1 ? 's' : ''}
              </p>
              {holdings.map((h) => (
                <Row key={h.name} label={h.name} value={formatINR(h.value)} />
              ))}
            </>
          )}
        </Block>
        <button
          type='button'
          onClick={() => navigate('/cashflow?tab=accounts')}
          className='self-start rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors'
        >
          Change linked accounts →
        </button>
      </div>

      <Tips
        items={[
          'Park emergency money where you can access it the same day: savings accounts, liquid funds, or FDs with instant liquidation',
          'Do not invest your emergency fund in stocks or equity. Accessibility matters more than returns',
          'Review monthly. If expenses rise, your required buffer also rises',
        ]}
      />
    </div>
  );
}

function SavingsDetail({ health }: { health: EssentialsHealth }) {
  const income = health.monthlyIncome;
  const rates = [10, 20, 30, 40, 50, 60, 65, 70, 80, 90];
  const userRate = Math.round(health.savings.rate);
  const yearsFor = (ratePct: number) => {
    const m = monthsToFinancialIndependence({
      liquidAssets: health.liquid.total,
      monthlySavings: (income * ratePct) / 100,
      monthlyExpense: health.monthlyExpense,
    });
    if (m == null) return '50+ years';
    const yrs = Math.round((m / 12) * 2) / 2;
    return `${yrs} years`;
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800'>
        <div className='flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          <span>Savings Rate</span>
          <span>Years to FI</span>
        </div>
        {rates.map((r, i) => (
          <div
            key={r}
            className={`flex items-center justify-between px-4 py-2 text-sm ${i > 0 ? 'border-t border-slate-200 dark:border-slate-800' : ''} ${r === userRate ? 'bg-emerald-500/10' : ''}`}
          >
            <span className='font-semibold text-slate-700 dark:text-slate-200'>
              {r}%
              {r === userRate && (
                <span className='ml-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400'>
                  ◀ You
                </span>
              )}
            </span>
            <span className='font-bold tabular-nums text-slate-900 dark:text-slate-100'>
              {yearsFor(r)}
            </span>
          </div>
        ))}
      </div>

      <SectionTitle>Monthly Budget Breakdown</SectionTitle>
      <Block>
        <Row label='Monthly Income' value={formatINR(income)} />
        <Row label='Monthly Expense' value={formatINR(health.monthlyExpense)} />
        <Row label='Net Savings' value={formatINR(health.monthlySavings)} />
        <Divider />
        <Row
          label='Savings Rate'
          value={`${Math.round(health.savings.rate)}%`}
          strong
          tone={health.savings.rate >= 20 ? 'good' : 'bad'}
        />
      </Block>

      <Tips
        items={[
          'Aim for 20%+ savings rate as a baseline — 50%+ accelerates FI significantly',
          'Automate investments on salary day to avoid lifestyle creep',
          'Every 10% increase in savings rate cuts years to FI dramatically',
        ]}
      />
    </div>
  );
}

function TermDetail({ health }: { health: EssentialsHealth }) {
  const annualExpense = health.monthlyExpense * 12;
  return (
    <div className='flex flex-col gap-4'>
      <SectionTitle>How the Ideal Cover is Calculated</SectionTitle>
      <Block>
        {health.term.formula === 'expense25' ? (
          <>
            <Row label='Annual Expense' value={formatINR(annualExpense)} />
            <Row label='× 25 (income replacement years)' value={formatINR(annualExpense * 25)} />
            <Row
              label='− Net Worth (already saved)'
              value={`−${formatINR(health.debt.netWorth)}`}
              tone='bad'
            />
            <Divider />
            <Row label='= Ideal Cover' value={formatINR(health.term.recommended)} strong tone='good' />
          </>
        ) : health.term.formula === 'income10' ? (
          <>
            <Row label='Annual Income' value={formatINR(health.monthlyIncome * 12)} />
            <Row label='× 10 (income replacement years)' value={formatINR(health.monthlyIncome * 12 * 10)} />
            <Divider />
            <Row label='= Ideal Cover' value={formatINR(health.term.recommended)} strong tone='good' />
          </>
        ) : (
          <p className='py-1 text-[13px] text-slate-500 dark:text-slate-400'>
            Add income or expense to your Financial Profile to compute an ideal cover.
          </p>
        )}
      </Block>

      <PolicyTable
        policies={health.term.policies}
        emptyLabel='No life/term policies yet — term insurance is the cheapest way to protect dependents.'
      />
      {health.term.activePremium > 0 && (
        <p className='text-[12px] text-slate-500 dark:text-slate-400'>
          Active premium outflow:{' '}
          <span className='font-bold text-slate-700 dark:text-slate-200'>
            {formatINR(health.term.activePremium)}
          </span>{' '}
          per premium cycle (sum of active policies).
        </p>
      )}

      <Tips
        items={[
          'Term insurance is pure protection — not investment. Avoid ULIPs or endowment plans',
          'Buy early — premiums are significantly lower in your 20s–30s',
          'Coverage should last until your youngest dependent becomes financially independent',
          'Riders to consider: Critical illness, accidental disability',
        ]}
      />
    </div>
  );
}

function HealthDetail({ health }: { health: EssentialsHealth }) {
  const people = 1 + health.health.dependents;
  const perPerson = people > 0 ? health.health.cover / people : 0;
  return (
    <div className='flex flex-col gap-4'>
      <SectionTitle>Coverage Adequacy Breakdown</SectionTitle>
      <Block>
        <Row label='People covered' value={`${people} (you + ${health.health.dependents} dependents)`} />
        <Row label='Your cover (active policies)' value={formatINR(health.health.cover)} />
        <Row label='Cover per person' value={formatINR(perPerson)} />
        <Divider />
        <Row label='Min recommended' value={formatINR(health.health.minRecommended)} />
        <Row label='Good recommended' value={formatINR(health.health.recommended)} tone='good' />
      </Block>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
        {[
          { t: 'Minimum (₹3L solo/₹5L family)', s: 'Basic hospitalisation cover' },
          { t: 'Good (₹5L+ solo/₹10L family)', s: 'Covers most planned surgeries' },
          { t: 'Ideal (₹10L+ solo/₹25L family)', s: 'Critical illness & super top-up' },
          { t: 'Super top-up', s: 'Cost-effective way to boost cover' },
        ].map((c) => (
          <div
            key={c.t}
            className='rounded-xl bg-slate-100 dark:bg-slate-800/60 px-4 py-2.5'
          >
            <p className='text-[13px] font-bold text-slate-900 dark:text-slate-100'>{c.t}</p>
            <p className='text-[11px] text-slate-500 dark:text-slate-400'>{c.s}</p>
          </div>
        ))}
      </div>

      <PolicyTable
        policies={health.health.policies}
        emptyLabel='No health policies yet — one hospitalisation can wipe out years of savings.'
      />
      {health.health.activePremium > 0 && (
        <p className='text-[12px] text-slate-500 dark:text-slate-400'>
          Active premium outflow:{' '}
          <span className='font-bold text-slate-700 dark:text-slate-200'>
            {formatINR(health.health.activePremium)}
          </span>{' '}
          per premium cycle (sum of active policies).
        </p>
      )}

      <Tips
        items={[
          "Employer health insurance doesn't count — it ends when you leave the job",
          'Buy individual policies and add a super top-up for cost-effective higher cover',
          'Look for: no room rent capping, no disease sub-limits, no co-pay clauses',
          'Buy when healthy — pre-existing conditions may not be covered for 2–4 years',
        ]}
      />
    </div>
  );
}

function DebtDetail({ health }: { health: EssentialsHealth }) {
  const ratioPct = health.debt.ratio * 100;
  const bands = [
    { label: '≤ 10%', verdict: 'Low leverage — very strong position', hit: ratioPct <= 10 },
    { label: '10–30%', verdict: 'Healthy — manageable debt level', hit: ratioPct > 10 && ratioPct <= 30 },
    { label: '30–50%', verdict: 'Moderate — keep reducing liabilities', hit: ratioPct > 30 && ratioPct <= 50 },
    { label: '> 50%', verdict: 'High leverage — focus on debt repayment', hit: ratioPct > 50 },
  ];
  return (
    <div className='flex flex-col gap-4'>
      <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800'>
        <div className='flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          <span>Debt / Assets</span>
          <span>Verdict</span>
        </div>
        {bands.map((b, i) => (
          <div
            key={b.label}
            className={`flex items-center justify-between gap-4 px-4 py-2 text-sm ${i > 0 ? 'border-t border-slate-200 dark:border-slate-800' : ''} ${b.hit ? 'bg-emerald-500/10' : ''}`}
          >
            <span className='font-semibold text-slate-700 dark:text-slate-200'>
              {b.label}
              {b.hit && (
                <span className='ml-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400'>
                  ◀ You
                </span>
              )}
            </span>
            <span className='text-right text-[13px] font-semibold text-slate-600 dark:text-slate-300'>
              {b.verdict}
            </span>
          </div>
        ))}
      </div>

      <SectionTitle>Balance Sheet Summary</SectionTitle>
      <Block>
        <Row label='Total Assets' value={formatINR(health.debt.totalAssets)} />
        <Row label='Total Liabilities' value={formatINR(health.debt.totalLiabilities)} />
        <Divider />
        <Row label='Net Worth' value={formatINR(health.debt.netWorth)} strong tone='good' />
        <Row label='Debt Ratio' value={`${ratioPct.toFixed(1)}%`} strong tone={ratioPct <= 30 ? 'good' : 'bad'} />
      </Block>

      <Tips
        items={[
          'Debt ratio = total liabilities ÷ total assets × 100',
          'Below 10% is considered an excellent debt position',
          'Prioritise clearing high-interest debt (credit cards, personal loans) first',
        ]}
      />
    </div>
  );
}

// ── Modal shell ─────────────────────────────────────────────────────────────

export function EssentialsDetailModal({
  kind,
  onClose,
  health,
  accounts,
  investments,
  cashflows,
}: {
  kind: EssentialsDetailKind | null;
  onClose: () => void;
  health: EssentialsHealth;
  accounts: Account[];
  investments: Investment[];
  cashflows: CashflowEntry[];
}) {
  if (!kind) return null;
  const meta = KIND_META[kind];
  const status =
    kind === 'emergency'
      ? health.emergency.status
      : kind === 'savings'
        ? health.savings.status
        : kind === 'term'
          ? health.term.status
          : kind === 'health'
            ? health.health.status
            : health.debt.status;

  return (
    <Modal open onClose={onClose} title={meta.title}>
      <div className='flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-2.5'>
            <span className='text-xl'>{meta.emoji}</span>
            <span className='text-base font-bold text-slate-900 dark:text-slate-100'>
              {meta.title}
            </span>
          </div>
          <EssentialsStatusBadge status={status} />
        </div>
        <Divider />
        {kind === 'emergency' && (
          <EmergencyDetail
            health={health}
            accounts={accounts}
            investments={investments}
            cashflows={cashflows}
          />
        )}
        {kind === 'savings' && <SavingsDetail health={health} />}
        {kind === 'term' && <TermDetail health={health} />}
        {kind === 'health' && <HealthDetail health={health} />}
        {kind === 'debt' && <DebtDetail health={health} />}
      </div>
    </Modal>
  );
}
