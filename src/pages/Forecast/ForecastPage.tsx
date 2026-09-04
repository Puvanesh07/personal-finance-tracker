/**
 * src/pages/Forecast/ForecastPage.tsx
 *
 * Full Cashflow Forecast page — /forecast
 * Shows available cash, 7/30/90-day forecast, full event list.
 */

import { CashflowForecastCard } from '../../components/dashboard/CashflowForecastCard';
import { FiTrendingUp } from 'react-icons/fi';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

export default function ForecastPage() {
  return (
    <div className='flex flex-col gap-6 pb-12'>
      <header className='rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg'>
            <FiTrendingUp className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2'>Cashflow Forecast <FeatureInfo feature='forecast' /></h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Projected cash position based on upcoming payments, EMIs and expected income.
            </p>
          </div>
        </div>
      </header>

      <CashflowForecastCard compact={false} />
    </div>
  );
}
