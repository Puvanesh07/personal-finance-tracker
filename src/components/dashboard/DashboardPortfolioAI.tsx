import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PortfolioAIAnalysisPanel } from '../insights/PortfolioAIAnalysisPanel';
import { usePortfolioStore } from '../../store/portfolioStore';
import { buildPortfolioAIContext } from '../../utils/portfolioAIContext';

export function DashboardPortfolioAI() {
  const investments = usePortfolioStore((s) => s.investments);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const essentials = usePortfolioStore((s) => s.essentials);
  const goals = usePortfolioStore((s) => s.goals);
  const context = useMemo(
    () => buildPortfolioAIContext({ investments, liabilities, cashflows, essentials, goals }),
    [investments, liabilities, cashflows, essentials, goals],
  );
  if (!context) return null;
  return (
    <section className='min-w-0'>
      <div className='mb-2 flex justify-end'>
        <Link to='/insights' className='text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline'>
          Full insights &amp; custom questions →
        </Link>
      </div>
      <PortfolioAIAnalysisPanel context={context} compact />
    </section>
  );
}

