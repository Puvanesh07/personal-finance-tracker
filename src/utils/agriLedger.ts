import type {
  AgriExpense,
  CoconutRecord,
  CropCycle,
  LivestockEvent,
  MilkRecord,
  ProduceSaleLot,
} from '../types/investmentTypes';

const safeCompare = (a: string | undefined, b: string | undefined) =>
  (a || '').localeCompare(b || '');

const EXPENSE_LABELS: Record<string, string> = {
  seeds: 'Seeds',
  fertilizer: 'Fertilizer',
  pesticides: 'Pesticides',
  labor: 'Labor',
  irrigation: 'Irrigation',
  tractor_fuel: 'Tractor / Land Work',
  equipment_repair: 'Equipment Repair',
  feed: 'Animal Feed',
  veterinary: 'Veterinary',
  medicine: 'Medicine',
  shed: 'Shed Maintenance',
  other: 'Other',
};

export type LedgerSource =
  | 'expense'
  | 'produce'
  | 'milk'
  | 'coconut_income'
  | 'coconut_expense'
  | 'livestock';

export type FarmLedgerEntry = {
  id: string;
  source: LedgerSource;
  rawId: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  label: string;
  plantation: string;
  detail?: string;
  emoji: string;
};

export type DayLedgerGroup = {
  date: string;
  entries: FarmLedgerEntry[];
  income: number;
  expense: number;
  net: number;
};

type AgriLedgerData = {
  agriExpenses: AgriExpense[];
  produceSales: ProduceSaleLot[];
  milkRecords: MilkRecord[];
  coconutRecords: CoconutRecord[];
  livestockEvents: LivestockEvent[];
  cropCycles: CropCycle[];
};

function plantationLabel(
  cropCycleId: string | undefined,
  cropName: string | undefined,
  plantationLabelField: string | undefined,
  cropCycles: CropCycle[],
): string {
  if (cropName) return cropName;
  if (plantationLabelField) return plantationLabelField;
  if (cropCycleId) {
    const c = cropCycles.find((x) => x.id === cropCycleId);
    if (c) return c.cropName;
  }
  return 'General Farm';
}

export function buildFarmLedger(data: AgriLedgerData): FarmLedgerEntry[] {
  const entries: FarmLedgerEntry[] = [];

  data.agriExpenses.forEach((e) => {
    const cat = EXPENSE_LABELS[e.category] ?? e.category;
    entries.push({
      id: `exp_${e.id}`,
      source: 'expense',
      rawId: e.id,
      date: e.date,
      type: 'expense',
      amount: e.amount,
      label: cat,
      plantation: plantationLabel(
        e.cropCycleId,
        e.cropName,
        e.plantationLabel,
        data.cropCycles,
      ),
      detail: e.notes,
      emoji: '💸',
    });
  });

  data.produceSales.forEach((p) => {
    entries.push({
      id: `prd_${p.id}`,
      source: 'produce',
      rawId: p.id,
      date: p.date,
      type: 'income',
      amount: p.totalAmount,
      label: `${p.produceName} sale`,
      plantation: p.produceName,
      detail: `${p.quantity} ${p.unit === 'custom' ? p.customUnit || 'unit' : p.unit} × ₹${p.pricePerUnit}`,
      emoji: '🧺',
    });
  });

  data.milkRecords.forEach((m) => {
    const amt = m.liters * m.pricePerLiter;
    const sessionLabel =
      m.session === 'morning'
        ? 'Morning'
        : m.session === 'evening'
          ? 'Evening'
          : '';
    entries.push({
      id: `mlk_${m.id}`,
      source: 'milk',
      rawId: m.id,
      date: m.date,
      type: 'income',
      amount: amt,
      label: sessionLabel ? `Dairy ${sessionLabel}` : 'Dairy income',
      plantation: 'Dairy',
      detail: `${sessionLabel ? sessionLabel + ' · ' : ''}${m.liters} L × ₹${m.pricePerLiter}/L`,
      emoji: m.session === 'evening' ? '🌙' : '🌅',
    });
  });

  data.coconutRecords.forEach((c) => {
    if (c.harvestIncome > 0) {
      entries.push({
        id: `coc_inc_${c.id}`,
        source: 'coconut_income',
        rawId: c.id,
        date: c.date,
        type: 'income',
        amount: c.harvestIncome,
        label: 'Coconut harvest',
        plantation: 'Coconut Grove',
        detail: c.notes,
        emoji: '🌴',
      });
    }
    if (c.investmentAmount > 0) {
      entries.push({
        id: `coc_exp_${c.id}`,
        source: 'coconut_expense',
        rawId: c.id,
        date: c.date,
        type: 'expense',
        amount: c.investmentAmount,
        label: 'Coconut expense',
        plantation: 'Coconut Grove',
        detail: c.notes,
        emoji: '🌴',
      });
    }
  });

  data.livestockEvents.forEach((e) => {
    if (e.eventType === 'sale' && (e.price ?? 0) > 0) {
      entries.push({
        id: `lve_sale_${e.id}`,
        source: 'livestock',
        rawId: e.id,
        date: e.date,
        type: 'income',
        amount: e.price!,
        label: `${e.animalType} sale`,
        plantation: 'Livestock',
        detail: e.notes,
        emoji: '🐄',
      });
    }
    if (e.eventType === 'purchase' && (e.price ?? 0) > 0) {
      entries.push({
        id: `lve_buy_${e.id}`,
        source: 'livestock',
        rawId: e.id,
        date: e.date,
        type: 'expense',
        amount: e.price!,
        label: `${e.animalType} purchase`,
        plantation: 'Livestock',
        detail: e.notes,
        emoji: '🐄',
      });
    }
  });

  return entries.sort((a, b) => safeCompare(b.date, a.date));
}

export function groupLedgerByDay(entries: FarmLedgerEntry[]): DayLedgerGroup[] {
  const map = new Map<string, FarmLedgerEntry[]>();
  entries.forEach((e) => {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  });

  return Array.from(map.entries())
    .map(([date, dayEntries]) => {
      const income = dayEntries
        .filter((e) => e.type === 'income')
        .reduce((s, e) => s + e.amount, 0);
      const expense = dayEntries
        .filter((e) => e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0);
      return {
        date,
        entries: dayEntries,
        income,
        expense,
        net: income - expense,
      };
    })
    .sort((a, b) => safeCompare(b.date, a.date));
}

export function uniquePlantations(entries: FarmLedgerEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.plantation))).sort();
}
