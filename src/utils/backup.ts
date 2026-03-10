// src/utils/backup.ts
import { saveAs } from 'file-saver'
import { collection, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
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
import type { SettingsRecord } from '../store/portfolioStore'

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

async function fetchAll<T>(colName: string): Promise<T[]> {
  const snap = await getDocs(collection(db, colName))
  return snap.docs.map(d => d.data() as T)
}

export async function exportFullBackup() {
  const [investments, liabilities, cashflows, goals, snapshots, networthSnapshots] = await Promise.all([
    fetchAll<Investment>('investments'),
    fetchAll<Liability>('liabilities'),
    fetchAll<CashflowEntry>('cashflows'),
    fetchAll<Goal>('goals'),
    fetchAll<PortfolioSnapshot>('snapshots'),
    fetchAll<NetWorthSnapshot>('networthSnapshots'),
  ])

  const settingsDoc = await getDoc(doc(db, 'settings', 'settings'))
  const settings = settingsDoc.exists() ? (settingsDoc.data() as SettingsRecord) : null

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

  const batch = writeBatch(db)

  // Function to add an array of items to the batch
  const addToBatch = (colName: string, items: any[]) => {
    items.forEach(item => {
      batch.set(doc(db, colName, item.id), item)
    })
  }

  addToBatch('investments', parsed.investments)
  addToBatch('liabilities', parsed.liabilities)
  addToBatch('cashflows', parsed.cashflows)
  addToBatch('goals', parsed.goals)
  addToBatch('snapshots', parsed.snapshots)
  addToBatch('networthSnapshots', parsed.networthSnapshots)

  batch.set(doc(db, 'settings', 'settings'), {
    id: 'settings',
    notion: parsed.notion ?? { enabled: false },
    essentials: parsed.essentials ?? {},
  })

  await batch.commit()
}