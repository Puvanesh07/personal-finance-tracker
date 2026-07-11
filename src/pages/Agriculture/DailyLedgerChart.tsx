import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR } from '../../utils/format';
import type { DayLedgerGroup } from '../../utils/agriLedger';

type ChartDay = {
  date: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  entries: DayLedgerGroup['entries'];
};

function buildChartDays(groups: DayLedgerGroup[], limit = 14): ChartDay[] {
  return groups
    .slice()
    .reverse()
    .slice(-limit)
    .map((d) => ({
      date: d.date,
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      }),
      income: d.income,
      expense: d.expense,
      net: d.net,
      entries: d.entries,
    }));
}

function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDay }[];
}) {
  if (!active || !payload?.[0]) return null;
  const day = payload[0].payload;
  return (
    <div className='max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-3 text-xs shadow-xl'>
      <p className='mb-2 text-sm font-bold text-white'>📅 {day.date}</p>
      <div className='mb-2 grid grid-cols-3 gap-2 text-center'>
        <div className='rounded-lg bg-emerald-500/20 px-2 py-1'>
          <p className='text-[10px] text-emerald-300'>Income</p>
          <p className='font-bold text-emerald-400'>{formatINR(day.income)}</p>
        </div>
        <div className='rounded-lg bg-red-500/20 px-2 py-1'>
          <p className='text-[10px] text-red-300'>Expense</p>
          <p className='font-bold text-red-400'>{formatINR(day.expense)}</p>
        </div>
        <div
          className={`rounded-lg px-2 py-1 ${day.net >= 0 ? 'bg-blue-500/20' : 'bg-rose-500/20'}`}
        >
          <p className='text-[10px] text-slate-300'>Net</p>
          <p
            className={`font-bold ${day.net >= 0 ? 'text-blue-400' : 'text-rose-400'}`}
          >
            {formatINR(day.net)}
          </p>
        </div>
      </div>
      {day.entries.length > 0 ? (
        <>
          <p className='mb-1 font-bold uppercase tracking-wider text-slate-400'>
            All entries ({day.entries.length})
          </p>
          <ul className='max-h-40 space-y-1 overflow-y-auto'>
            {day.entries.map((e) => (
              <li
                key={e.id}
                className='flex items-start justify-between gap-2 rounded-lg bg-slate-800/80 px-2 py-1.5'
              >
                <span className='min-w-0 text-slate-200'>
                  {e.emoji} {e.label}
                  <span className='block text-[10px] text-slate-400'>
                    {e.plantation}
                    {e.detail ? ` · ${e.detail}` : ''}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-bold tabular-nums ${e.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {e.type === 'income' ? '+' : '−'}
                  {formatINR(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className='text-slate-500'>No entries this day</p>
      )}
    </div>
  );
}

export function DailyLedgerChart({ dayGroups }: { dayGroups: DayLedgerGroup[] }) {
  const data = buildChartDays(dayGroups);
  if (data.length === 0) return null;

  return (
    <div className='w-full'>
      <p className='mb-2 text-xs text-slate-500 dark:text-slate-400'>
        Hover any bar to see income, expense, net, and every entry for that day
      </p>
      <div className='h-[280px] w-full min-w-0'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={data} barGap={2} barCategoryGap='18%'>
            <CartesianGrid strokeDasharray='3 3' stroke='#334155' opacity={0.35} />
            <XAxis
              dataKey='label'
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              interval={0}
              angle={data.length > 7 ? -35 : 0}
              textAnchor={data.length > 7 ? 'end' : 'middle'}
              height={data.length > 7 ? 50 : 30}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(v) =>
                Math.abs(Number(v)) >= 1000
                  ? `₹${(Number(v) / 1000).toFixed(0)}k`
                  : `₹${v}`
              }
            />
            <Tooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) =>
                value === 'income' ? 'Income' : value === 'expense' ? 'Expense' : value
              }
            />
            <Bar
              dataKey='income'
              name='income'
              fill='#22c55e'
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey='expense'
              name='expense'
              fill='#ef4444'
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
