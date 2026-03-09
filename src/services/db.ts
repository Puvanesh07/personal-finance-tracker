import Dexie, { type Table } from 'dexie'
import type {
  CashflowEntry,
  EssentialsConfig,
  Goal,
  Investment,
  Liability,
  NetWorthSnapshot,
  NotionConfig,
  PortfolioSnapshot,
} from '../types/investmentTypes'

export type SettingsRecord = {
  id: 'settings'
  notion: NotionConfig
  essentials?: EssentialsConfig
}

class PortfolioDB extends Dexie {
  investments!: Table<Investment, string>
  snapshots!: Table<PortfolioSnapshot, string>
  liabilities!: Table<Liability, string>
  cashflows!: Table<CashflowEntry, string>
  goals!: Table<Goal, string>
  networthSnapshots!: Table<NetWorthSnapshot, string>
  settings!: Table<SettingsRecord, string>

  constructor() {
    super('portfolio_db')
    this.version(1).stores({
      investments: 'id, type, name, platform, updatedAt',
      snapshots: 'id, date',
      settings: 'id',
    })

    this.version(2).stores({
      investments: 'id, type, name, platform, updatedAt',
      snapshots: 'id, date',
      liabilities: 'id, type, name, updatedAt',
      settings: 'id',
    })

    this.version(3).stores({
      investments: 'id, type, name, platform, updatedAt',
      snapshots: 'id, date',
      liabilities: 'id, type, name, updatedAt',
      cashflows: 'id, type, date, category, updatedAt',
      goals: 'id, updatedAt',
      networthSnapshots: 'id, createdAt',
      settings: 'id',
    })
  }
}

export const db = new PortfolioDB()

