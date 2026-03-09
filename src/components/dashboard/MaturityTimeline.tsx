import { useMemo } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { formatINR } from '../../utils/format'
import { formatISODateLabel, todayISO } from '../../utils/dateUtils'

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
    <Card title="Maturity timeline" right={rows.length ? 'Next 8' : undefined}>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-600">Add a bond or fixed deposit to track maturity dates.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {r.type}
                  </span>
                  <div className="truncate text-sm font-medium">{r.name}</div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Matures on {formatISODateLabel(r.maturityDate)} · {r.daysLeft >= 0 ? `${r.daysLeft} days left` : 'matured'}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(r.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

