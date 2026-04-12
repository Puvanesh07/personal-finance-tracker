import { useMemo } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'
import { formatISODateLabel, todayISO } from '../../utils/dateUtils'
import { FiClock } from 'react-icons/fi'

type MaturityRow = {
  id: string
  type: 'Bond' | 'FD'
  name: string
  maturityDate: string
  amount: number
  daysLeft: number
}

export function MaturityTimeline() {
  const investments = usePortfolioStore((s) => s.investments)

  const rows = useMemo(() => {
    const today = parseISO(todayISO())
    const list: MaturityRow[] = []
    for (const inv of investments) {
      if (inv.type === 'bond') {
        const daysLeft = differenceInCalendarDays(parseISO(inv.maturityDate), today)
        list.push({
          id: inv.id,
          type: 'Bond',
          name: inv.name,
          maturityDate: inv.maturityDate,
          amount: inv.investedAmount,
          daysLeft,
        })
      }
      if (inv.type === 'fixed_deposit') {
        const daysLeft = differenceInCalendarDays(parseISO(inv.maturityDate), today)
        list.push({
          id: inv.id,
          type: 'FD',
          name: inv.bankName,
          maturityDate: inv.maturityDate,
          amount: inv.investedAmount,
          daysLeft,
        })
      }
    }
    return list.sort((a, b) => a.maturityDate.localeCompare(b.maturityDate)).slice(0, 8)
  }, [investments])

  return (
    <Card 
      title={<div className="flex items-center gap-2"><FiClock className="text-amber-500"/> Maturity Timeline</div>} 
      right={rows.length ? <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Next 8</span> : undefined}
    >
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center rounded-xl bg-slate-50/50 p-6 text-sm font-medium text-slate-900 dark:text-slate-500 dark:bg-slate-800/30">
          Add a bond or fixed deposit to track maturity dates.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-colors hover:bg-slate-50 dark:border-slate-800/50 dark:bg-slate-800/20 dark:hover:bg-slate-800/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.type === 'FD' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                    {r.type}
                  </span>
                  <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">{r.name}</div>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Matures {formatISODateLabel(r.maturityDate)}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className={r.daysLeft <= 30 && r.daysLeft >= 0 ? 'text-rose-500 font-bold' : ''}>
                    {r.daysLeft >= 0 ? `${r.daysLeft} days left` : 'Matured'}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-sm font-black tabular-nums text-slate-900 dark:text-slate-50">
                {formatINR(r.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}