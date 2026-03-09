import { create } from 'zustand'
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
import { createId } from '../utils/id'
import { todayISO } from '../utils/dateUtils'
import { summarizePortfolio } from '../utils/calculations'
import { db, type SettingsRecord } from '../services/db'

type PortfolioState = {
  ready: boolean
  investments: Investment[]
  snapshots: PortfolioSnapshot[]
  liabilities: Liability[]
  cashflows: CashflowEntry[]
  goals: Goal[]
  networthSnapshots: NetWorthSnapshot[]
  notion: NotionConfig
  essentials: EssentialsConfig

  hydrate: () => Promise<void>
  addInvestment: (investment: Omit<Investment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateInvestment: (id: string, patch: Partial<Investment>) => Promise<void>
  deleteInvestment: (id: string) => Promise<void>
  addLiability: (liability: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateLiability: (id: string, patch: Partial<Liability>) => Promise<void>
  deleteLiability: (id: string) => Promise<void>
  addCashflow: (entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>
  deleteCashflow: (id: string) => Promise<void>
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  clearAllData: () => Promise<void>

  setNotionConfig: (patch: Partial<NotionConfig>) => Promise<void>
  setEssentialsConfig: (patch: Partial<EssentialsConfig>) => Promise<void>
  recordSnapshotIfNeeded: () => Promise<void>
  recordSnapshotNow: () => Promise<void>
  takeNetWorthSnapshot: (label?: string) => Promise<void>
}

const DEFAULT_NOTION: NotionConfig = { enabled: false }
const DEFAULT_ESSENTIALS: EssentialsConfig = {}

async function loadSettings(): Promise<SettingsRecord> {
  const existing = await db.settings.get('settings')
  if (existing) return existing
  const initial: SettingsRecord = { id: 'settings', notion: DEFAULT_NOTION, essentials: DEFAULT_ESSENTIALS }
  await db.settings.put(initial)
  return initial
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  ready: false,
  investments: [],
  snapshots: [],
  liabilities: [],
  cashflows: [],
  goals: [],
  networthSnapshots: [],
  notion: DEFAULT_NOTION,
  essentials: DEFAULT_ESSENTIALS,

  hydrate: async () => {
    const [investments, snapshots, liabilities, cashflows, goals, networthSnapshots, settings] = await Promise.all([
      db.investments.toArray(),
      db.snapshots.orderBy('date').toArray(),
      db.liabilities.toArray(),
      db.cashflows.toArray(),
      db.goals.toArray(),
      db.networthSnapshots.orderBy('createdAt').reverse().toArray(),
      loadSettings(),
    ])

    set({
      ready: true,
      investments: investments.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      snapshots,
      liabilities: liabilities.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      cashflows: cashflows.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
      goals: goals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      networthSnapshots,
      notion: settings.notion ?? DEFAULT_NOTION,
      essentials: settings.essentials ?? DEFAULT_ESSENTIALS,
    })

    // Ensure at least one "today" snapshot exists when there are investments.
    if (investments.length > 0) {
      await get().recordSnapshotIfNeeded()
    }
  },

  addInvestment: async (investment) => {
    const now = new Date().toISOString()
    const withMeta: Investment = {
      ...(investment as Investment),
      id: createId('inv'),
      createdAt: now,
      updatedAt: now,
    }
    await db.investments.put(withMeta)
    set((s) => ({ investments: [withMeta, ...s.investments] }))
    await get().recordSnapshotIfNeeded()
  },

  updateInvestment: async (id, patch) => {
    const existing = await db.investments.get(id)
    if (!existing) return
    const updated: Investment = {
      ...(existing as Investment),
      ...(patch as Investment),
      id,
      updatedAt: new Date().toISOString(),
    }
    await db.investments.put(updated)
    set((s) => ({ investments: s.investments.map((x) => (x.id === id ? updated : x)) }))
    await get().recordSnapshotIfNeeded()
  },

  deleteInvestment: async (id) => {
    await db.investments.delete(id)
    set((s) => ({ investments: s.investments.filter((x) => x.id !== id) }))
    await get().recordSnapshotIfNeeded()
  },

  addLiability: async (liability) => {
    const now = new Date().toISOString()
    const withMeta: Liability = {
      ...(liability as Liability),
      id: createId('lia'),
      createdAt: now,
      updatedAt: now,
    }
    await db.liabilities.put(withMeta)
    set((s) => ({ liabilities: [withMeta, ...s.liabilities] }))
  },

  updateLiability: async (id, patch) => {
    const existing = await db.liabilities.get(id)
    if (!existing) return
    const updated: Liability = {
      ...(existing as Liability),
      ...(patch as Liability),
      id,
      updatedAt: new Date().toISOString(),
    }
    await db.liabilities.put(updated)
    set((s) => ({ liabilities: s.liabilities.map((x) => (x.id === id ? updated : x)) }))
  },

  deleteLiability: async (id) => {
    await db.liabilities.delete(id)
    set((s) => ({ liabilities: s.liabilities.filter((x) => x.id !== id) }))
  },

  addCashflow: async (entry) => {
    const now = new Date().toISOString()
    const withMeta: CashflowEntry = {
      ...(entry as CashflowEntry),
      id: createId('cf'),
      createdAt: now,
      updatedAt: now,
    }
    await db.cashflows.put(withMeta)
    set((s) => ({ cashflows: [withMeta, ...s.cashflows] }))
  },

  updateCashflow: async (id, patch) => {
    const existing = await db.cashflows.get(id)
    if (!existing) return
    const updated: CashflowEntry = {
      ...(existing as CashflowEntry),
      ...(patch as CashflowEntry),
      id,
      updatedAt: new Date().toISOString(),
    }
    await db.cashflows.put(updated)
    set((s) => ({ cashflows: s.cashflows.map((x) => (x.id === id ? updated : x)) }))
  },

  deleteCashflow: async (id) => {
    await db.cashflows.delete(id)
    set((s) => ({ cashflows: s.cashflows.filter((x) => x.id !== id) }))
  },

  addGoal: async (goal) => {
    const now = new Date().toISOString()
    const withMeta: Goal = {
      ...(goal as Goal),
      id: createId('goal'),
      createdAt: now,
      updatedAt: now,
    }
    await db.goals.put(withMeta)
    set((s) => ({ goals: [withMeta, ...s.goals] }))
  },

  updateGoal: async (id, patch) => {
    const existing = await db.goals.get(id)
    if (!existing) return
    const updated: Goal = {
      ...(existing as Goal),
      ...(patch as Goal),
      id,
      updatedAt: new Date().toISOString(),
    }
    await db.goals.put(updated)
    set((s) => ({ goals: s.goals.map((x) => (x.id === id ? updated : x)) }))
  },

  deleteGoal: async (id) => {
    await db.goals.delete(id)
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id) }))
  },

  clearAllData: async () => {
    await Promise.all([
      db.investments.clear(),
      db.snapshots.clear(),
      db.liabilities.clear(),
      db.cashflows.clear(),
      db.goals.clear(),
      db.networthSnapshots.clear(),
      db.settings.delete('settings'),
    ])
    set({
      investments: [],
      snapshots: [],
      liabilities: [],
      cashflows: [],
      goals: [],
      networthSnapshots: [],
      notion: DEFAULT_NOTION,
      essentials: DEFAULT_ESSENTIALS,
    })
  },

  setNotionConfig: async (patch) => {
    const settings = await loadSettings()
    const updated: SettingsRecord = { ...settings, notion: { ...settings.notion, ...patch } }
    await db.settings.put(updated)
    set({ notion: updated.notion })
  },

  setEssentialsConfig: async (patch) => {
    const settings = await loadSettings()
    const updated: SettingsRecord = { ...settings, essentials: { ...(settings.essentials ?? {}), ...patch } }
    await db.settings.put(updated)
    set({ essentials: updated.essentials ?? DEFAULT_ESSENTIALS })
  },

  recordSnapshotIfNeeded: async () => {
    const date = todayISO()
    const existing = await db.snapshots.where('date').equals(date).first()
    const { totalValue } = summarizePortfolio(get().investments)
    if (existing) {
      const updated: PortfolioSnapshot = { ...existing, totalValue }
      await db.snapshots.put(updated)
      set((s) => ({ snapshots: s.snapshots.map((x) => (x.id === updated.id ? updated : x)) }))
      return
    }

    const snap: PortfolioSnapshot = { id: createId('snap'), date, totalValue }
    await db.snapshots.put(snap)
    set((s) => ({ snapshots: [...s.snapshots, snap].sort((a, b) => a.date.localeCompare(b.date)) }))
  },

  recordSnapshotNow: async () => {
    // For a frontend-only daily timeline, a "manual snapshot" means "update today's snapshot to current total".
    await get().recordSnapshotIfNeeded()
  },

  takeNetWorthSnapshot: async (label) => {
    const { totalValue } = summarizePortfolio(get().investments)
    const totalLiabilities = get().liabilities.reduce((acc, l) => acc + (l.outstanding || 0), 0)
    const now = new Date().toISOString()
    const snap: NetWorthSnapshot = {
      id: createId('nws'),
      createdAt: now,
      label: label?.trim() || undefined,
      totalAssets: totalValue,
      totalLiabilities,
      netWorth: totalValue - totalLiabilities,
    }
    await db.networthSnapshots.put(snap)
    set((s) => ({ networthSnapshots: [snap, ...s.networthSnapshots] }))
  },
}))

