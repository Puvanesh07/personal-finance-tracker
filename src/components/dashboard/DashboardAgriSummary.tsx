import { FiSun } from 'react-icons/fi';
import { formatCurrency } from '../../utils/format';
import { useAgriStore } from '../../store/agricultureStore';

export function DashboardAgriSummary() {
  const { cropCycles, agriExpenses, milkRecords, coconutRecords } =
    useAgriStore();

  const activeCrops = cropCycles.filter((c) => !c.actualHarvestDate).length;
  const totalAgriExpenses = agriExpenses.reduce((sum, e) => sum + e.amount, 0);

  const harvestIncome = cropCycles.reduce(
    (sum, c) => sum + (c.harvestIncome || 0),
    0,
  );
  const milkIncome = milkRecords.reduce(
    (sum, m) => sum + m.liters * m.pricePerLiter,
    0,
  );
  const coconutIncome = coconutRecords.reduce(
    (sum, c) => sum + (c.harvestIncome || 0),
    0,
  );
  const totalAgriIncome = harvestIncome + milkIncome + coconutIncome;

  const netAgriProfit = totalAgriIncome - totalAgriExpenses;

  return (
    <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
          <FiSun className='text-amber-400' />
          Agriculture Overview
        </h2>
      </div>

      <div className='mb-5 flex justify-between items-end'>
        <div>
          <p className='text-xs font-medium text-slate-400 uppercase tracking-wider'>
            All-Time Net Profit
          </p>
          <p
            className={`text-2xl font-bold ${netAgriProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {netAgriProfit >= 0 ? '+' : ''}
            {formatCurrency(netAgriProfit)}
          </p>
        </div>
        <div className='text-right'>
          <span className='inline-flex items-center rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-400 border border-amber-500/20'>
            {activeCrops} Active Crops
          </span>
        </div>
      </div>

      <div className='mt-auto grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-4'>
        <div>
          <p className='text-xs font-medium text-slate-400 mb-1'>
            Total Revenue
          </p>
          <p className='text-sm font-semibold text-emerald-400'>
            {formatCurrency(totalAgriIncome)}
          </p>
        </div>
        <div>
          <p className='text-xs font-medium text-slate-400 mb-1'>
            Total Expenses
          </p>
          <p className='text-sm font-semibold text-rose-400'>
            {formatCurrency(totalAgriExpenses)}
          </p>
        </div>
      </div>
    </div>
  );
}
