// src/pages/Tools/ToolsPage.tsx
import { useState } from 'react'
import { FiPieChart, FiTarget } from 'react-icons/fi'
import { AiFillCalculator } from 'react-icons/ai'

// ── Calculators
import { SIPCalculator } from './Calculator/SIPCalculator'
import {
  CAGRCalculator, EMICalculator, FDCalculator,
  InflationAdjuster, LumpsumCalculator, PPFCalculator, NPSCalculator,
} from './Calculator/InvestmentCalculators'

// ── Analysis
import {
  TaxHarvestingFinder, StockPLSummary, XIRRCalculator,
  PortfolioRebalancing, FDMaturityTracker, DividendTracker, AssetAllocationMap,
} from './analysis/PortfolioAnalyzers'

// ── Planning
import {
  FIRECalculator, LoanPrepaymentAnalyser, RiskAnalyser,
  GoalPlanner, RetirementPlanner,
} from './planning/PlanningTools'

type ToolCategory = 'calculators' | 'analysis' | 'planning'

export function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolCategory>('calculators')

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <header className="rounded-2xl bg-gradient-to-r from-blue-600/10 to-transparent p-6 border border-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
            <AiFillCalculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Investment Tools</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              20 calculators and analysers to master your finances.
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-fit gap-1">
        <TabBtn active={activeTab === 'calculators'} onClick={() => setActiveTab('calculators')} icon={<AiFillCalculator />} label="Calculators" />
        <TabBtn active={activeTab === 'analysis'}    onClick={() => setActiveTab('analysis')}    icon={<FiPieChart />}      label="Analysis" />
        <TabBtn active={activeTab === 'planning'}    onClick={() => setActiveTab('planning')}    icon={<FiTarget />}        label="Planning" />
      </div>

      {/* Grids */}
      <main>
        {activeTab === 'calculators' && <CalculatorsGrid />}
        {activeTab === 'analysis'    && <AnalysisGrid />}
        {activeTab === 'planning'    && <PlanningGrid />}
      </main>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
        active
          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function CalculatorsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <SIPCalculator />
      <LumpsumCalculator />
      <FDCalculator />
      <EMICalculator />
      <PPFCalculator />
      <NPSCalculator />
      <InflationAdjuster />
      <CAGRCalculator />
    </div>
  )
}

function AnalysisGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <XIRRCalculator />
      <DividendTracker />
      <StockPLSummary />
      <FDMaturityTracker />
      <PortfolioRebalancing />
      <AssetAllocationMap />
      <TaxHarvestingFinder />
    </div>
  )
}

function PlanningGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FIRECalculator />
      <GoalPlanner />
      <RetirementPlanner />
      <RiskAnalyser />
      <LoanPrepaymentAnalyser />
    </div>
  )
}