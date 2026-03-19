// src/components/dashboard/DashboardTopHoldingsInsights.tsx
//
// NEW: FinBoom-style Top Holdings cards + smart Insights panel
//      Side by side on dashboard — Top Holdings (left) + Insights (right)

import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiInfo,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import {
  currentValue,
  investedValue,
  summarizePortfolio,
} from '../../utils/calculations';

import { BsFillLightbulbFill } from 'react-icons/bs';
import type { Investment } from '../../types/investmentTypes';
import { formatINR } from '../../utils/format';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── helpers ──────────────────────────────────────────────────────────────

function typeLabel(inv: Investment): string {
  switch (inv.type) {
    case 'stock':
      return 'Equity';
    case 'mutual_fund':
      return 'MF';
    case 'bond':
      return 'Bond';
    case 'fixed_deposit':
      return 'FD/RD';
    case 'other':
      return inv.assetType === 'gold'
        ? 'Gold'
        : inv.assetType === 'real_estate'
          ? 'RE'
          : 'Other';
    default:
      return 'Other';
  }
}

const TYPE_PILL: Record<string, string> = {
  Equity: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  MF: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  Bond: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  'FD/RD': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Gold: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  RE: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  Other: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

function formatShort(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return formatINR(n);
}

// ── Top Holdings Card ─────────────────────────────────────────────────────

function HoldingCard({ inv }: { inv: Investment }) {
  const cv = currentValue(inv);
  const iv = investedValue(inv);
  const pl = cv - iv;
  const isProfit = pl >= 0;
  const tag = typeLabel(inv);

  return (
    <div className='rounded-xl border border-slate-800/80 bg-slate-800/30 p-4 flex flex-col gap-2 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-200'>
      {/* Name + tag */}
      <div className='flex items-start justify-between gap-2'>
        <p className='text-sm font-semibold text-slate-100 leading-tight line-clamp-2 flex-1'>
          {inv.name}
        </p>
        <span
          className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${TYPE_PILL[tag] ?? TYPE_PILL.Other}`}
        >
          {tag}
        </span>
      </div>
      {/* Value */}
      <p className='text-xl font-bold text-slate-50 tabular-nums'>
        {formatShort(cv)}
      </p>
      {/* P&L */}
      {iv > 0 && (
        <p
          className={`text-xs font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}
        >
          {isProfit ? '+' : ''}
          {formatShort(pl)}{' '}
          <span className='opacity-70'>
            ({isProfit ? '+' : ''}
            {iv > 0 ? ((pl / iv) * 100).toFixed(1) : 0}%)
          </span>
        </p>
      )}
    </div>
  );
}

// ── Insight Row ───────────────────────────────────────────────────────────

type InsightSeverity = 'warning' | 'info' | 'tip';

function InsightRow({
  severity,
  title,
  action,
  onAction,
}: {
  severity: InsightSeverity;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const icon =
    severity === 'warning' ? (
      <FiAlertTriangle className='h-4 w-4 text-amber-400 shrink-0 mt-0.5' />
    ) : severity === 'tip' ? (
      <BsFillLightbulbFill className='h-4 w-4 text-sky-400 shrink-0 mt-0.5' />
    ) : (
      <FiInfo className='h-4 w-4 text-slate-400 shrink-0 mt-0.5' />
    );

  return (
    <div className='flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-0'>
      {icon}
      <p className='text-sm text-slate-300 flex-1 leading-snug'>{title}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className='shrink-0 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap'
        >
          {action} →
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function DashboardTopHoldingsInsights() {
  const investments = usePortfolioStore((s) => s.investments);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const essentials = usePortfolioStore((s) => s.essentials);
  const navigate = useNavigate();

  // Top 5 holdings by current value
  const topHoldings = useMemo(() => {
    return [...investments]
      .sort((a, b) => currentValue(b) - currentValue(a))
      .slice(0, 5);
  }, [investments]);

  // Smart insights (like FinBoom)
  const insights = useMemo(() => {
    const result: {
      severity: InsightSeverity;
      title: string;
      action?: string;
      route?: string;
    }[] = [];
    const summary = summarizePortfolio(investments);
    const totalValue = summary.totalValue;
    const totalLiabilities = liabilities.reduce(
      (a, l) => a + (l.outstanding || 0),
      0,
    );

    if (totalValue === 0) {
      result.push({
        severity: 'tip',
        title: 'Add your first investment to see portfolio insights.',
        action: 'Add investment',
        route: '/investments',
      });
      return result;
    }

    // Allocation insights
    const fdBondPct =
      totalValue > 0
        ? ((summary.byType.fixed_deposit.current +
            summary.byType.bond.current) /
            totalValue) *
          100
        : 0;
    const equityPct =
      totalValue > 0
        ? ((summary.byType.stock.current + summary.byType.mutual_fund.current) /
            totalValue) *
          100
        : 0;

    if (fdBondPct > 60) {
      result.push({
        severity: 'warning',
        title: `${fdBondPct.toFixed(0)}% in Debt — consider diversifying into equity for better long-term returns.`,
        action: 'View allocation',
        route: '/investments',
      });
    }
    if (equityPct > 80) {
      result.push({
        severity: 'warning',
        title: `Heavy equity tilt at ${equityPct.toFixed(0)}%. Adding debt instruments reduces downside risk.`,
        action: 'View allocation',
        route: '/investments',
      });
    }

    // Debt-to-asset ratio
    if (totalLiabilities > 0 && totalValue > 0) {
      const ratio = totalLiabilities / totalValue;
      if (ratio > 0.5) {
        result.push({
          severity: 'warning',
          title: `Liabilities are ${(ratio * 100).toFixed(0)}% of your assets. Focus on debt repayment.`,
          action: 'View liabilities',
          route: '/liabilities',
        });
      }
    }

    // Cashflow-based insights
    const now = new Date();
    const thisMonthCf = cashflows.filter((c) => {
      const d = new Date(c.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });
    const monthlyIncome = thisMonthCf
      .filter((c) => c.type === 'income')
      .reduce((a, c) => a + c.amount, 0);
    const monthlyExpense = thisMonthCf
      .filter((c) => c.type === 'expense')
      .reduce((a, c) => a + c.amount, 0);

    if (monthlyIncome === 0) {
      result.push({
        severity: 'info',
        title: `No income recorded for ${now.toLocaleString('default', { month: 'long' })}.`,
        action: 'Add income',
        route: '/cashflow',
      });
    } else if (monthlyExpense > monthlyIncome) {
      result.push({
        severity: 'warning',
        title: `Spending exceeds income this month by ${formatINR(monthlyExpense - monthlyIncome)}.`,
        action: 'View cashflow',
        route: '/cashflow',
      });
    }

    // Emergency fund
    const efTarget = essentials?.emergencyFundTarget || 0;
    const efCurrent = essentials?.emergencyFundCurrent || 0;
    if (efTarget > 0 && efCurrent < efTarget * 0.5) {
      result.push({
        severity: 'warning',
        title: `Emergency fund is only ${((efCurrent / efTarget) * 100).toFixed(0)}% funded. Target: ${formatINR(efTarget)}.`,
        action: 'View settings',
        route: '/settings',
      });
    }

    // Positive insight
    if (summary.profitLossTotal > 0) {
      result.push({
        severity: 'tip',
        title: `Unrealized gain of ${formatINR(summary.profitLossTotal)} on your portfolio. Keep investing!`,
      });
    }

    // Rebalance suggestion
    if (equityPct > 0 && equityPct < 30 && totalValue > 50000) {
      result.push({
        severity: 'tip',
        title: `Equity at ${equityPct.toFixed(0)}%. Adding Stocks or MFs can boost long-term returns.`,
        action: 'Add investment',
        route: '/investments',
      });
    }

    return result.slice(0, 4); // max 4 insights
  }, [investments, liabilities, cashflows, essentials]);

  return (
    <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6'>
      {/* ── Top Holdings ─────────────────────────────────────────── */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-base font-bold text-slate-100'>
            <FiTrendingUp className='text-emerald-400 h-4 w-4' />
            Top Holdings
          </h2>
          <button
            onClick={() => navigate('/investments')}
            className='flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors rounded-lg px-2 py-1 hover:bg-slate-800'
          >
            View all <FiArrowUpRight className='h-3.5 w-3.5' />
          </button>
        </div>

        {topHoldings.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-800'>
            <FiTrendingUp className='h-8 w-8 text-slate-600 mb-2' />
            <p className='text-sm text-slate-500'>No investments yet.</p>
            <button
              onClick={() => navigate('/investments')}
              className='mt-3 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors'
            >
              Add your first investment →
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-3'>
            {topHoldings.map((inv) => (
              <HoldingCard key={inv.id} inv={inv} />
            ))}
          </div>
        )}
      </div>

      {/* ── Insights ─────────────────────────────────────────────── */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-base font-bold text-slate-100'>
            <FiZap className='text-amber-400 h-4 w-4' />
            Insights
          </h2>
          <button
            onClick={() => navigate('/insights')}
            className='flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors rounded-lg px-2 py-1 hover:bg-slate-800'
          >
            Full analysis <FiArrowUpRight className='h-3.5 w-3.5' />
          </button>
        </div>

        <div className='flex flex-col'>
          {insights.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-slate-800'>
              <FiZap className='h-8 w-8 text-slate-600 mb-2' />
              <p className='text-sm text-slate-500'>
                No insights yet. Add data to get started.
              </p>
            </div>
          ) : (
            insights.map((ins, i) => (
              <InsightRow
                key={i}
                severity={ins.severity}
                title={ins.title}
                action={ins.action}
                onAction={ins.route ? () => navigate(ins.route!) : undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
