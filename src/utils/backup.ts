import { saveAs } from 'file-saver'
import { db } from '../services/db'
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

export type BackupPayload = {
  version: 1
  createdAt: string
  investments: Investment[]
  liabilities: Liability[]
  cashflows: CashflowEntry[]
  goals: Goal[]
  snapshots: PortfolioSnapshot[]
  networthSnapshots: NetWorthSnapshot[]
  notion: NotionConfig
  essentials: EssentialsConfig
}

export async function exportFullBackup() {
  const [investments, liabilities, cashflows, goals, snapshots, networthSnapshots, settings] = await Promise.all([
    db.investments.toArray(),
    db.liabilities.toArray(),
    db.cashflows.toArray(),
    db.goals.toArray(),
    db.snapshots.toArray(),
    db.networthSnapshots.toArray(),
    db.settings.get('settings'),
  ])

  const payload: BackupPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    investments,
    liabilities,
    cashflows,
    goals,
    snapshots,
    networthSnapshots,
    notion: settings?.notion ?? { enabled: false },
    essentials: settings?.essentials ?? {},
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  saveAs(blob, 'personal-finance-backup.json')
}

export async function importFullBackup(jsonText: string) {
  const parsed = JSON.parse(jsonText) as BackupPayload
  if (!parsed || parsed.version !== 1) throw new Error('Unsupported backup format or version.')

  // Replace all data (like a restore).
  await db.transaction(
    'rw',
    [db.investments, db.liabilities, db.cashflows, db.goals, db.snapshots, db.networthSnapshots, db.settings],
    async () => {
      await Promise.all([
        db.investments.clear(),
        db.liabilities.clear(),
        db.cashflows.clear(),
        db.goals.clear(),
        db.snapshots.clear(),
        db.networthSnapshots.clear(),
      ])
      await Promise.all([
        db.investments.bulkAdd(parsed.investments),
        db.liabilities.bulkAdd(parsed.liabilities),
        db.cashflows.bulkAdd(parsed.cashflows),
        db.goals.bulkAdd(parsed.goals),
        db.snapshots.bulkAdd(parsed.snapshots),
        db.networthSnapshots.bulkAdd(parsed.networthSnapshots),
      ])
      await db.settings.put({
        id: 'settings',
        notion: parsed.notion ?? { enabled: false },
        essentials: parsed.essentials ?? {},
      })
    },
  )
}

