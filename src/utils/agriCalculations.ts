import type {
  AgriExpense,
  CoconutRecord,
  CropCycle,
  LivestockEvent,
  MilkRecord,
  ProduceSaleLot,
} from '../types/investmentTypes';

export type AgriSummary = {
  cropIncome: number;
  milkIncome: number;
  coconutIncome: number;
  produceIncome: number;
  livestockSaleIncome: number;
  totalIncome: number;
  cropInvestment: number;
  farmExpenses: number;
  coconutInvestment: number;
  livestockPurchaseCost: number;
  totalExpenses: number;
  netProfit: number;
  activeCrops: number;
  profitPercent: number;
};

export type CropMetrics = {
  totalInvestment: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitPercent: number;
  costPerKg: number;
  sellingProfit: number;
};

/** Per-crop P&L with cost-per-kg and profit % for dashboards & overview. */
export function computeCropMetrics(
  crop: CropCycle,
  expenses: AgriExpense[],
): CropMetrics {
  const extraExpenses = expenses
    .filter((e) => e.cropCycleId === crop.id)
    .reduce((s, e) => s + e.amount, 0);
  const totalInvestment = (crop.investedAmount || 0) + extraExpenses;
  const totalIncome = crop.harvestIncome || 0;
  const netProfit = totalIncome - totalInvestment;
  const qtyKg = crop.quantityKg || 0;
  return {
    totalInvestment,
    totalIncome,
    totalExpenses: totalInvestment,
    netProfit,
    profitPercent:
      totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0,
    costPerKg: qtyKg > 0 ? totalInvestment / qtyKg : 0,
    sellingProfit: netProfit,
  };
}

type AgriData = {
  cropCycles: CropCycle[];
  agriExpenses: AgriExpense[];
  milkRecords: MilkRecord[];
  coconutRecords: CoconutRecord[];
  livestockEvents: LivestockEvent[];
  produceSales: ProduceSaleLot[];
};

/** Canonical all-time agriculture P&L (matches Reports page logic). */
export function computeAgriSummary(data: AgriData): AgriSummary {
  const cropIncome = data.cropCycles.reduce(
    (s, c) => s + (c.harvestIncome || 0),
    0,
  );
  const milkIncome = data.milkRecords.reduce(
    (s, m) => s + m.liters * m.pricePerLiter,
    0,
  );
  const coconutIncome = data.coconutRecords.reduce(
    (s, c) => s + (c.harvestIncome || 0),
    0,
  );
  const produceIncome = data.produceSales.reduce(
    (s, p) => s + (p.totalAmount || 0),
    0,
  );
  const livestockSaleIncome = data.livestockEvents
    .filter((e) => e.eventType === 'sale')
    .reduce((s, e) => s + (e.price ?? 0), 0);

  const cropInvestment = data.cropCycles.reduce(
    (s, c) => s + (c.investedAmount || 0),
    0,
  );
  const farmExpenses = data.agriExpenses.reduce((s, e) => s + e.amount, 0);
  const coconutInvestment = data.coconutRecords.reduce(
    (s, c) => s + (c.investmentAmount || 0),
    0,
  );
  const livestockPurchaseCost = data.livestockEvents
    .filter((e) => e.eventType === 'purchase')
    .reduce((s, e) => s + (e.price ?? 0), 0);

  const totalIncome =
    cropIncome +
    milkIncome +
    coconutIncome +
    produceIncome +
    livestockSaleIncome;
  const totalExpenses =
    cropInvestment + farmExpenses + coconutInvestment + livestockPurchaseCost;
  const netProfit = totalIncome - totalExpenses;

  return {
    cropIncome,
    milkIncome,
    coconutIncome,
    produceIncome,
    livestockSaleIncome,
    totalIncome,
    cropInvestment,
    farmExpenses,
    coconutInvestment,
    livestockPurchaseCost,
    totalExpenses,
    netProfit,
    profitPercent: totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0,
    activeCrops: data.cropCycles.filter((c) => !c.actualHarvestDate).length,
  };
}
