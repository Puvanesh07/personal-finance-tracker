// src/services/dummyDataService.ts
/**
 * Generates realistic dummy data for Fintrackly testing.
 * Only the owner account (puvanesh1964@gmail.com) can load this data.
 * All dates are dynamically generated using the current date.
 */

import {
  addDays,
  addMonths,
  format,
  subDays,
  subMonths,
} from 'date-fns';
import type {
  Account,
  AgriExpense,
  AgriExpenseCategory,
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceTransaction,
  CashflowEntry,
  CoconutRecord,
  Credential,
  CropCycle,
  Field,
  Goal,
  GoalContribution,
  InsurancePayment,
  InsurancePolicy,
  Investment,
  LendingBorrower,
  LendingTransaction,
  Liability,
  LivestockEvent,
  MilkRecord,
  PendingPayment,
  ProduceSaleLot,
  SalaryRecord,
  TrackedPayment,
} from '../types/investmentTypes';
import type { LedgerEntry } from '../types/ledgerTypes';
import { db } from './firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { encryptDoc } from './encryptionService';

// ─── Date Helpers ─────────────────────────────────────────────────────────────
const now = () => new Date();
const todayStr = () => format(now(), 'yyyy-MM-dd');
const future = (days: number) => format(addDays(now(), days), 'yyyy-MM-dd');
const past = (days: number) => format(subDays(now(), days), 'yyyy-MM-dd');
const futureMonth = (months: number) => format(addMonths(now(), months), 'yyyy-MM-dd');
const pastMonth = (months: number) => format(subMonths(now(), months), 'yyyy-MM-dd');

// ─── Data Generators ──────────────────────────────────────────────────────────

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateAccounts(): Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[] {
  return [
    { name: 'HDFC Bank Savings', type: 'bank', balance: 125000, openingBalance: 100000, openingBalanceDate: past(365) },
    { name: 'SBI Salary Account', type: 'bank', balance: 45000, openingBalance: 40000, openingBalanceDate: past(730) },
    { name: 'Axis Credit Card', type: 'credit', balance: -18500, openingBalance: 0, openingBalanceDate: past(180) },
    { name: 'Paytm Payments Bank', type: 'bank', balance: 8200, openingBalance: 5000, openingBalanceDate: past(90) },
    { name: 'Kotak Mutual Fund SIP', type: 'bank', balance: 0, openingBalance: 0, openingBalanceDate: past(30) },
  ];
}

function generateInvestments(uid: string): Investment[] {
  const items: Investment[] = [];
  const today = todayStr();

  // Stocks
  items.push({
    id: genId('inv'), type: 'stock', name: 'Reliance Industries', symbol: 'RELIANCE',
    platform: 'manual', quantity: 50, buyPrice: 2350, currentPrice: 2980,
    sector: 'Energy', convictionTag: 'core', createdAt: past(200), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'stock', name: 'HDFC Bank', symbol: 'HDFCBANK',
    platform: 'manual', quantity: 100, buyPrice: 1420, currentPrice: 1650,
    sector: 'Banking', convictionTag: 'core', createdAt: past(180), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'stock', name: 'Tata Motors', symbol: 'TATAMOTORS',
    platform: 'manual', quantity: 200, buyPrice: 620, currentPrice: 780,
    sector: 'Auto', convictionTag: 'risky_bet', createdAt: past(120), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'stock', name: 'Infosys', symbol: 'INFY',
    platform: 'manual', quantity: 30, buyPrice: 1380, currentPrice: 1520,
    sector: 'IT', convictionTag: 'core', createdAt: past(300), updatedAt: today, userId: uid,
  } as unknown as Investment);

  // Mutual Funds
  items.push({
    id: genId('inv'), type: 'mutual_fund', name: 'Parag Parikh Flexi Cap', symbol: 'PPFAS',
    platform: 'manual', units: 450.5, nav: 82.3, investedAmount: 37000,
    convictionTag: 'core', createdAt: past(400), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'mutual_fund', name: 'Nifty 50 Index Fund', symbol: 'NIFTY',
    platform: 'manual', units: 800, nav: 125.6, investedAmount: 100000,
    convictionTag: 'core', createdAt: past(365), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'mutual_fund', name: 'Axis Long Term Equity', symbol: 'AXIS_ELSS',
    platform: 'manual', units: 320, nav: 72.5, investedAmount: 23000,
    convictionTag: 'satellite', createdAt: past(250), updatedAt: today, userId: uid,
  } as unknown as Investment);

  // Bonds
  items.push({
    id: genId('inv'), type: 'bond', name: 'India Gold Bond 2024', symbol: 'GB',
    platform: 'manual', investedAmount: 50000, interestRate: 2.5,
    durationMonths: 8, startDate: past(180), maturityDate: futureMonth(10),
    createdAt: past(180), updatedAt: today, userId: uid,
  } as unknown as Investment);

  // FDs
  items.push({
    id: genId('inv'), type: 'fixed_deposit', name: 'SBI FD 73 Months', platform: 'manual',
    bankName: 'SBI', investedAmount: 200000, interestRate: 7.1,
    durationMonths: 73, startDate: past(365), maturityDate: futureMonth(38),
    createdAt: past(365), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'fixed_deposit', name: 'HDFC FD 2 Years', platform: 'manual',
    bankName: 'HDFC', investedAmount: 150000, interestRate: 7.0,
    durationMonths: 24, startDate: past(120), maturityDate: futureMonth(458),
    createdAt: past(120), updatedAt: today, userId: uid,
  } as unknown as Investment);

  // Other
  items.push({
    id: genId('inv'), type: 'other', name: 'SGB 2021 Tranche IV', platform: 'manual',
    assetType: 'gold', investedAmount: 46000, currentValue: 55000, currentPrice: 6250,
    createdAt: past(730), updatedAt: today, userId: uid,
  } as unknown as Investment);
  items.push({
    id: genId('inv'), type: 'other', name: 'PPF Account', platform: 'manual',
    assetType: 'ppf', investedAmount: 150000, currentValue: 195000,
    createdAt: past(1095), updatedAt: today, userId: uid,
  } as unknown as Investment);

  return items;
}

function generateLiabilities(uid: string): Liability[] {
  const today = todayStr();
  return [
    {
      id: genId('lia'), type: 'loan', name: 'Home Loan - HDFC',
      principal: 5000000, outstanding: 4250000, interestRate: 8.5,
      startDate: pastMonth(24), emiAmount: 41500, emiDay: 5,
      status: 'active', createdAt: pastMonth(24), updatedAt: today, userId: uid,
    },
    {
      id: genId('lia'), type: 'loan', name: 'Car Loan - SBI',
      principal: 800000, outstanding: 320000, interestRate: 9.0,
      startDate: pastMonth(18), emiAmount: 15800, emiDay: 15,
      status: 'active', createdAt: pastMonth(18), updatedAt: today, userId: uid,
    },
    {
      id: genId('lia'), type: 'credit_card', name: 'Axis Credit Card',
      principal: 18500, outstanding: 18500, interestRate: 36,
      startDate: pastMonth(3), emiAmount: 0, emiDay: 0,
      status: 'active', createdAt: pastMonth(3), updatedAt: today, userId: uid,
    },
    {
      id: genId('lia'), type: 'loan', name: 'Personal Loan - ICICI',
      principal: 300000, outstanding: 120000, interestRate: 11.5,
      startDate: pastMonth(10), emiAmount: 10200, emiDay: 20,
      status: 'active', createdAt: pastMonth(10), updatedAt: today, userId: uid,
    },
  ];
}

function generateTrackedPayments(uid: string): TrackedPayment[] {
  const today = todayStr();
  return [
    { id: genId('tp'), title: 'HDFC Home Loan EMI', paymentType: 'emi', amount: 41500, dueDate: future(1), status: 'pending', reminderDays: [7, 3, 1], recurrence: 'monthly', createdAt: past(365), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'SBI Car Loan EMI', paymentType: 'emi', amount: 15800, dueDate: future(4), status: 'pending', reminderDays: [7, 3, 1], recurrence: 'monthly', createdAt: past(180), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'Axis Credit Card Bill', paymentType: 'credit_card', amount: 18500, dueDate: future(12), status: 'pending', reminderDays: [7, 3, 1], recurrence: 'monthly', createdAt: past(90), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'HDFC FD Interest', paymentType: 'fd_maturity', amount: 7350, dueDate: past(3), status: 'paid', paidAt: past(3), reminderDays: [7, 3, 1], recurrence: 'none', createdAt: past(365), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'Zomato Gold Subscription', paymentType: 'custom', amount: 299, dueDate: future(5), status: 'pending', reminderDays: [3, 1], recurrence: 'yearly', createdAt: past(365), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'Muthoot Gold Loan EMI', paymentType: 'personal_loan', amount: 5500, dueDate: past(7), status: 'paid', paidAt: past(7), reminderDays: [7, 3, 1], recurrence: 'monthly', createdAt: past(180), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'Electricity Bill', paymentType: 'custom', amount: 3200, dueDate: future(10), status: 'pending', reminderDays: [7, 3], recurrence: 'monthly', createdAt: past(30), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'Water Bill', paymentType: 'custom', amount: 850, dueDate: future(10), status: 'pending', reminderDays: [3, 1], recurrence: 'monthly', createdAt: past(30), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'Phone Internet Bill', paymentType: 'custom', amount: 1499, dueDate: future(8), status: 'pending', reminderDays: [3], recurrence: 'monthly', createdAt: past(60), updatedAt: today, userId: uid },
    { id: genId('tp'), title: 'ICICI Personal Loan EMI', paymentType: 'personal_loan', amount: 10200, dueDate: future(16), status: 'pending', reminderDays: [7, 3, 1], recurrence: 'monthly', createdAt: past(300), updatedAt: today, userId: uid },
  ];
}

function generatePendingPayments(uid: string): PendingPayment[] {
  const today = todayStr();
  return [
    { id: genId('pp'), buyerName: 'Rajesh Kumar', buyerPhone: '9876543210', itemDescription: 'Tomato Sale - Harvest batch 3', amount: 25000, saleDate: past(5), expectedPaymentDate: future(5), status: 'pending', createdAt: past(5), updatedAt: today, userId: uid },
    { id: genId('pp'), buyerName: 'Vijay Exports', buyerPhone: '8765432109', itemDescription: 'Coconut Delivery - 500 kg', amount: 18000, saleDate: past(3), expectedPaymentDate: future(17), status: 'pending', createdAt: past(3), updatedAt: today, userId: uid },
    { id: genId('pp'), buyerName: 'Mohan Dairy', buyerPhone: '7654321098', itemDescription: 'Milk Credit Payment - July', amount: 42000, saleDate: past(30), expectedPaymentDate: past(5), status: 'pending', createdAt: past(30), updatedAt: today, userId: uid },
    { id: genId('pp'), buyerName: 'Suresh Agricoop', buyerPhone: '6543210987', itemDescription: 'Paddy Sale - Harvest', amount: 65000, saleDate: past(15), expectedPaymentDate: past(3), status: 'received', receivedAt: past(2), createdAt: past(15), updatedAt: today, userId: uid },
    { id: genId('pp'), buyerName: 'Priya Traders', buyerPhone: '5432109876', itemDescription: 'Pepper Sale - Premium Quality', amount: 35000, saleDate: past(7), expectedPaymentDate: future(23), status: 'pending', createdAt: past(7), updatedAt: today, userId: uid },
  ];
}

function generateCashflows(): CashflowEntry[] {
  const items: CashflowEntry[] = [];
  const today = todayStr();

  for (let i = 0; i < 80; i++) {
    const d = past(Math.floor(Math.random() * 120));
    const isIncome = Math.random() > 0.6;
    const amount = isIncome
      ? [50000, 41500, 15800, 10200, 7350, 25000, 18000, 42000, 65000, 35000][Math.floor(Math.random() * 10)]
      : [18500, 3200, 850, 1499, 299, 5500, 8000, 12000, 2500, 4500][Math.floor(Math.random() * 10)];
    items.push({
      id: genId('cf'),
      type: isIncome ? 'income' : 'expense',
      date: d,
      category: isIncome
        ? ['Salary', 'Dividend', 'Interest', 'Agriculture Sale', 'Rental', 'Bonus'][Math.floor(Math.random() * 6)]
        : ['Rent', 'Groceries', 'Utilities', 'Insurance', 'EMI', 'Fuel', 'Education', 'Healthcare', 'Entertainment', 'Shopping'][Math.floor(Math.random() * 10)],
      amount,
      notes: isIncome ? 'Auto-synced' : undefined,
      createdAt: d,
      updatedAt: today,
    });
  }
  // Sort by date descending
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

function generateGoals(uid: string): Goal[] {
  const today = todayStr();
  return [
    { id: genId('goal'), name: 'Emergency Fund', targetAmount: 500000, currentAmount: 320000, dueDate: futureMonth(18), status: 'active', createdAt: past(365), updatedAt: today, userId: uid },
    { id: genId('goal'), name: 'Vacation - Europe', targetAmount: 300000, currentAmount: 85000, dueDate: futureMonth(8), status: 'active', createdAt: past(200), updatedAt: today, userId: uid },
    { id: genId('goal'), name: 'Child Education', targetAmount: 2000000, currentAmount: 450000, dueDate: futureMonth(72), status: 'active', createdAt: past(730), updatedAt: today, userId: uid },
    { id: genId('goal'), name: 'New Car', targetAmount: 1200000, currentAmount: 680000, dueDate: futureMonth(24), status: 'active', createdAt: past(180), updatedAt: today, userId: uid },
    { id: genId('goal'), name: 'Retirement Corpus', targetAmount: 15000000, currentAmount: 3200000, dueDate: futureMonth(240), status: 'active', createdAt: past(1095), updatedAt: today, userId: uid },
  ];
}

function generateGoalContributions(uid: string): GoalContribution[] {
  const items: GoalContribution[] = [];
  const today = todayStr();
  const goalIds = ['goal_a', 'goal_b', 'goal_c'];
  for (let i = 0; i < 25; i++) {
    const month = format(subMonths(now(), Math.floor(Math.random() * 12)), 'yyyy-MM-dd');
    items.push({
      id: genId('gc'), goalId: goalIds[i % 3], amount: [10000, 15000, 20000, 5000, 25000][Math.floor(Math.random() * 5)],
      date: month, userId: uid, createdAt: month, updatedAt: today,
    });
  }
  return items;
}

function generateInsurancePolicies(uid: string): InsurancePolicy[] {
  const today = todayStr();
  return [
    {
      id: genId('ins_pol'), type: 'health', provider: 'HDFC ERGO', policyName: 'Health Protect Plus',
      coverageAmount: 1000000, premiumAmount: 12500, premiumFrequency: 'yearly',
      renewalDate: futureMonth(3), createdAt: past(365), updatedAt: today, userId: uid,
    },
    {
      id: genId('ins_pol'), type: 'life', provider: 'LIC', policyName: 'LIC Jeevan Tarun',
      coverageAmount: 5000000, premiumAmount: 45000, premiumFrequency: 'yearly',
      renewalDate: futureMonth(8), createdAt: past(730), updatedAt: today, userId: uid,
    },
    {
      id: genId('ins_pol'), type: 'vehicle', provider: 'ICICI Lombard', policyName: 'Car Insurance Comprehensive',
      coverageAmount: 800000, premiumAmount: 18500, premiumFrequency: 'yearly',
      renewalDate: past(10), createdAt: past(365), updatedAt: today, userId: uid,
    },
    {
      id: genId('ins_pol'), type: 'life', provider: 'HDFC Life', policyName: 'Click 2 Protect Gold',
      coverageAmount: 10000000, premiumAmount: 85000, premiumFrequency: 'yearly',
      renewalDate: futureMonth(12), createdAt: past(365), updatedAt: today, userId: uid,
    },
  ];
}

function generateInsurancePayments(uid: string): InsurancePayment[] {
  const today = todayStr();
  return [
    { id: genId('inspay'), policyId: 'ins_pol_x', amount: 12500, paidAt: past(90), createdAt: past(90), updatedAt: today, userId: uid },
    { id: genId('inspay'), policyId: 'ins_pol_y', amount: 45000, paidAt: past(180), createdAt: past(180), updatedAt: today, userId: uid },
  ];
}

function generateLendingBorrowers(uid: string): LendingBorrower[] {
  const today = todayStr();
  return [
    { id: genId('lendb'), name: 'Arun Sharma', phone: '9876543210', status: 'active', interestRate: 12, nextDueDate: future(3), createdAt: past(180), updatedAt: today, userId: uid },
    { id: genId('lendb'), name: 'Deepak Verma', phone: '8765432109', status: 'active', interestRate: 10, nextDueDate: future(15), createdAt: past(365), updatedAt: today, userId: uid },
    { id: genId('lendb'), name: 'Kiran Patel', phone: '7654321098', status: 'active', interestRate: 15, nextDueDate: past(7), createdAt: past(90), updatedAt: today, userId: uid },
    { id: genId('lendb'), name: 'Ravi Kumar', phone: '6543210987', status: 'closed', interestRate: 12, nextDueDate: undefined, createdAt: past(400), updatedAt: today, userId: uid },
  ];
}

function generateLendingTransactions(uid: string): LendingTransaction[] {
  const items: LendingTransaction[] = [];
  const today = todayStr();
  const borrowerIds = ['lendb_a', 'lendb_b', 'lendb_c'];
  for (let i = 0; i < 12; i++) {
    items.push({
      id: genId('lendtx'), borrowerId: borrowerIds[i % 3],
      type: i < 4 ? 'principal_given' : i < 8 ? 'interest_paid' : 'principal_returned',
      amount: [25000, 50000, 15000, 30000, 20000, 10000, 45000, 35000, 5000, 8000, 12000, 7000][i],
      date: past(Math.floor(Math.random() * 365)),
      createdAt: past(Math.floor(Math.random() * 365)), updatedAt: today, userId: uid,
    });
  }
  return items;
}

function generateCredentials(uid: string): Credential[] {
  return [
    { id: genId('cred'), category: 'identity', title: 'PAN Card', identifier: 'ABCDE1234F', notes: 'Permanent Account Number', createdAt: past(365), updatedAt: past(30), userId: uid },
    { id: genId('cred'), category: 'identity', title: 'Aadhaar Card', identifier: 'XXXX-XXXX-1234', notes: 'Aadhar Number', createdAt: past(365), updatedAt: past(30), userId: uid },
    { id: genId('cred'), category: 'login', title: 'HDFC Net Banking', identifier: 'hdfc_user', secret: '••••••••', notes: 'Username for net banking', createdAt: past(365), updatedAt: past(400), userId: uid },
    { id: genId('cred'), category: 'finance', title: 'ICICI Bank', identifier: 'icici_acc', notes: 'Account details', createdAt: past(365), updatedAt: past(60), userId: uid },
    { id: genId('cred'), category: 'login', title: 'Groww Investment App', identifier: 'groww_user', secret: '••••••••', notes: 'Investment platform', createdAt: past(200), updatedAt: past(10), userId: uid },
    { id: genId('cred'), category: 'note', title: 'Stock Brokerage', identifier: 'zerodha', notes: 'Demat account details', createdAt: past(300), updatedAt: past(15), userId: uid },
  ];
}

function generateFields(): Omit<Field, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[] {
  return [
    { name: 'Tomato Field - North', areAcres: 2.5, location: 'North Boundary', soilType: 'Clay Loam' },
    { name: 'Coconut Block - East', areAcres: 1.8, location: 'Eastern Edge', soilType: 'Sandy Loam' },
    { name: 'Dairy Unit', areAcres: 0.5, location: 'Near House', soilType: 'Red Soil' },
    { name: 'Sugarcane Field', areAcres: 3.0, location: 'West Side', soilType: 'Alluvial' },
    { name: 'Vegetable Garden', areAcres: 0.3, location: 'Backyard', soilType: 'Loamy' },
  ];
}

/** Deterministic IDs shared across all agri generators so cross-references work. */
const FLD = { tomato: 'fld_tomato', coconut: 'fld_coconut', dairy: 'fld_dairy', sugarcane: 'fld_sugarcane', veg: 'fld_veg' };
const CRP = { tomato1: 'crp_tomato_summer', tomato2: 'crp_tomato_monsoon', sugarcane: 'crp_sugarcane', fodder: 'crp_fodder' };

function generateCropCycles(uid: string): CropCycle[] {
  const today = todayStr();
  return [
    { id: CRP.tomato1, fieldId: FLD.tomato, fieldName: 'Tomato Field - North', cropName: 'Tomato', season: 'summer', startDate: pastMonth(3), expectedHarvestDate: past(10), actualHarvestDate: past(8), investedAmount: 45000, harvestIncome: 120000, quantityKg: 5000, createdAt: past(90), updatedAt: today, userId: uid },
    { id: CRP.tomato2, fieldId: FLD.tomato, fieldName: 'Tomato Field - North', cropName: 'Tomato', season: 'monsoon', startDate: past(15), expectedHarvestDate: future(75), actualHarvestDate: undefined, investedAmount: 38000, harvestIncome: 0, quantityKg: 0, createdAt: past(15), updatedAt: today, userId: uid },
    { id: CRP.sugarcane, fieldId: FLD.sugarcane, fieldName: 'Sugarcane Field', cropName: 'Sugarcane', season: 'winter', startDate: pastMonth(6), expectedHarvestDate: future(120), actualHarvestDate: undefined, investedAmount: 60000, harvestIncome: 0, quantityKg: 0, createdAt: past(180), updatedAt: today, userId: uid },
    { id: CRP.fodder, fieldId: FLD.dairy, fieldName: 'Dairy Unit', cropName: 'Fodder', season: 'summer', startDate: pastMonth(2), expectedHarvestDate: past(30), actualHarvestDate: past(25), investedAmount: 8000, harvestIncome: 0, quantityKg: 2000, createdAt: past(60), updatedAt: today, userId: uid },
  ];
}

function generateAgriExpenses(uid: string): AgriExpense[] {
  const today = todayStr();
  const cat: AgriExpenseCategory[] = ['seeds', 'fertilizer', 'pesticides', 'labor', 'irrigation', 'tractor_fuel', 'equipment_repair', 'feed', 'veterinary', 'medicine', 'shed', 'other'];
  const cropIds = [CRP.tomato1, CRP.tomato2, CRP.sugarcane, CRP.fodder];
  const cropNames = ['Tomato', 'Tomato', 'Sugarcane', 'Fodder'];
  const amounts = [500, 2000, 3500, 8000, 12000, 15000, 25000, 45000, 60000];
  const items: AgriExpense[] = [];
  for (let i = 0; i < 40; i++) {
    const d = past(Math.floor(Math.random() * 180));
    const j = i % cropIds.length;
    items.push({
      id: genId('aex'), cropCycleId: cropIds[j], cropName: cropNames[j],
      category: cat[i % cat.length], amount: amounts[Math.floor(Math.random() * amounts.length)],
      date: d, createdAt: d, updatedAt: today, userId: uid,
    });
  }
  return items;
}

function generateMilkRecords(uid: string): MilkRecord[] {
  const today = todayStr();
  const items: MilkRecord[] = [];
  for (let i = 0; i < 30; i++) {
    const d = past(Math.floor(Math.random() * 60));
    items.push({
      id: genId('mlk'), date: d, session: i % 2 === 0 ? 'morning' : 'evening',
      liters: [10, 12, 15, 18, 20, 22][Math.floor(Math.random() * 6)],
      pricePerLiter: 55, soldTo: 'Mohan Dairy', createdAt: d, updatedAt: today, userId: uid,
    });
  }
  return items;
}

function generateCoconutRecords(uid: string): CoconutRecord[] {
  const today = todayStr();
  return [
    { id: genId('coc'), date: past(10), numberOfTrees: 80, totalCoconuts: 1200, sellMethod: 'by_count', pricePerCoconut: 25, harvestIncome: 30000, investmentAmount: 5000, durationMonths: 12, createdAt: past(30), updatedAt: today, userId: uid },
    { id: genId('coc'), date: past(40), numberOfTrees: 80, totalCoconuts: 1500, sellMethod: 'by_count', pricePerCoconut: 24, harvestIncome: 36000, investmentAmount: 4000, durationMonths: 12, createdAt: past(60), updatedAt: today, userId: uid },
    { id: genId('coc'), date: past(70), numberOfTrees: 80, totalCoconuts: 1800, sellMethod: 'by_count', pricePerCoconut: 26, harvestIncome: 46800, investmentAmount: 6000, durationMonths: 12, createdAt: past(90), updatedAt: today, userId: uid },
  ];
}

function generateLivestockEvents(uid: string): LivestockEvent[] {
  const today = todayStr();
  return [
    { id: genId('lve'), animalType: 'cow', eventType: 'existing', count: 5, price: 120000, date: past(365), createdAt: past(365), updatedAt: today, userId: uid },
    { id: genId('lve'), animalType: 'cow', eventType: 'purchase', count: 2, price: 90000, date: past(60), createdAt: past(60), updatedAt: today, userId: uid },
    { id: genId('lve'), animalType: 'buffalo', eventType: 'purchase', count: 1, price: 75000, date: past(90), createdAt: past(90), updatedAt: today, userId: uid },
    { id: genId('lve'), animalType: 'cow', eventType: 'sale', count: 1, price: 95000, date: past(15), createdAt: past(15), updatedAt: today, userId: uid },
    { id: genId('lve'), animalType: 'cow', eventType: 'birth', count: 1, price: 0, date: past(20), createdAt: past(20), updatedAt: today, userId: uid },
  ];
}

function generateProduceSales(uid: string): ProduceSaleLot[] {
  const today = todayStr();
  return [
    { id: genId('prd'), produceName: 'Tomato', category: 'Vegetable', unit: 'kg', quantity: 500, pricePerUnit: 24, totalAmount: 12000, date: past(8), createdAt: past(8), updatedAt: today, userId: uid },
    { id: genId('prd'), produceName: 'Tomato', category: 'Vegetable', unit: 'kg', quantity: 800, pricePerUnit: 22, totalAmount: 17600, date: past(15), createdAt: past(15), updatedAt: today, userId: uid },
    { id: genId('prd'), produceName: 'Green Chilli', category: 'Vegetable', unit: 'kg', quantity: 200, pricePerUnit: 80, totalAmount: 16000, date: past(20), createdAt: past(20), updatedAt: today, userId: uid },
    { id: genId('prd'), produceName: 'Sugarcane', category: 'Crop', unit: 'quintal', quantity: 10, pricePerUnit: 3500, totalAmount: 35000, date: past(25), createdAt: past(25), updatedAt: today, userId: uid },
  ];
}

/** Shared deterministic employee IDs used by attendance generators. */
const EMP = { ravi: 'emp_ravi', suresh: 'emp_suresh', karthik: 'emp_karthik', mohan: 'emp_mohan', ganesh: 'emp_ganesh' };

function generateEmployees(): Omit<AttendanceEmployee, 'id' | 'createdAt' | 'updatedAt' | 'userId'>[] {
  return [
    { name: 'Ravi', phone: '9876543210', dailyWage: 700, notes: 'Permanent worker', plantationLabel: 'Tomato Field' },
    { name: 'Suresh', phone: '8765432109', dailyWage: 650, notes: 'Permanent worker', plantationLabel: 'Coconut Block' },
    { name: 'Karthik', phone: '7654321098', dailyWage: 800, notes: 'Skilled labor', plantationLabel: 'Dairy Unit' },
    { name: 'Mohan', phone: '6543210987', dailyWage: 600, notes: 'Part-time', plantationLabel: 'Sugarcane Field' },
    { name: 'Ganesh', phone: '5432109876', dailyWage: 750, notes: 'Supervisor', plantationLabel: 'Tomato Field' },
  ];
}

function generateAttendanceRecords(uid: string): AttendanceRecord[] {
  const today = todayStr();
  const records: AttendanceRecord[] = [];
  const employees = generateEmployees();
  for (const emp of employees) {
    for (let i = 0; i < 60; i++) {
      const d = subDays(now(), i);
      if (d.getDay() === 0) continue; // skip Sundays
      const present = Math.random() > 0.1;
      const wageSnapshot = emp.dailyWage;
      records.push({
        id: genId('att'), employeeId: EMP[emp.name.toLowerCase() as keyof typeof EMP], date: format(d, 'yyyy-MM-dd'),
        present, wage: present ? wageSnapshot : 0, wageSnapshot,
        userId: uid, createdAt: format(d, 'yyyy-MM-dd'), updatedAt: today,
      });
    }
  }
  return records;
}

function generateAttendanceTransactions(uid: string): AttendanceTransaction[] {
  const today = todayStr();
  const items: AttendanceTransaction[] = [];
  for (let i = 0; i < 20; i++) {
    const empKeys = ['ravi', 'suresh', 'karthik', 'mohan', 'ganesh'];
    items.push({
      id: genId('txn'), employeeId: EMP[empKeys[i % 5] as keyof typeof EMP],
      type: i % 3 === 0 ? 'advance' : 'deduction',
      amount: [2000, 3000, 5000, 1500, 4000][i % 5],
      date: past(Math.floor(Math.random() * 60)),
      createdAt: past(Math.floor(Math.random() * 60)), updatedAt: today, userId: uid,
    });
  }
  return items;
}

function generateSalaryRecords(uid: string): SalaryRecord[] {
  const today = todayStr();
  const items: SalaryRecord[] = [];
  const empKeys = ['ravi', 'suresh', 'karthik', 'mohan', 'ganesh'] as const;
  for (let m = 0; m < 3; m++) {
    const month = format(subMonths(now(), m), 'yyyy-MM');
    for (let e = 0; e < 5; e++) {
      const dailyWage = [700, 650, 800, 600, 750][e];
      const daysWorked = 22 - Math.floor(Math.random() * 3);
      const baseSalary = dailyWage * daysWorked;
      const extraWork = Math.floor(Math.random() * 3000);
      const advance = [0, 2000, 3000, 0, 1500][e];
      const deductions = [0, 0, 500, 0, 0][e];
      const totalSalary = baseSalary + extraWork;
      const finalSalary = totalSalary - advance - deductions;
      const paid = m === 0;
      const paidAmount = paid ? finalSalary : 0;
      items.push({
        id: genId('sal'), employeeId: EMP[empKeys[e] as keyof typeof EMP], month,
        daysWorked, baseSalary, extraWork, totalSalary, advance,
        deductions, finalSalary, paidAmount, paymentStatus: paid ? 'paid' : 'unpaid',
        createdAt: format(subMonths(now(), m), 'yyyy-MM-dd'), updatedAt: today, userId: uid,
      });
    }
  }
  return items;
}

// ─── Firestore Writer ─────────────────────────────────────────────────────────

const userDoc = (uid: string, col: string, id: string) => doc(db, 'users', uid, col, id);

async function batchWrite(uid: string, colName: string, items: any[]) {
  if (!items.length) return;
  for (let i = 0; i < items.length; i += 499) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + 499)) {
      if (!item?.id) continue;
      const withUser = { ...item, userId: uid };
      const encrypted = await encryptDoc(uid, withUser);
      batch.set(userDoc(uid, colName, item.id), encrypted);
    }
    await batch.commit();
  }
}

export interface DummyDataResult {
  success: boolean;
  message: string;
  counts: Record<string, number>;
}

export async function loadDummyData(uid: string): Promise<DummyDataResult> {
  const today = todayStr();
  const counts: Record<string, number> = {};

  // 1. Accounts
  const accounts = generateAccounts();
  const accountDocs = accounts.slice(0, 2).map((a) => ({
    id: genId('acc'), ...a, createdAt: past(30), updatedAt: today, userId: uid,
  }));
  await batchWrite(uid, 'accounts', accountDocs);
  counts['accounts'] = accountDocs.length;

  // 2. Investments
  const investments = generateInvestments(uid).slice(0, 5);
  await batchWrite(uid, 'investments', investments);
  counts['investments'] = investments.length;

  // 3. Liabilities
  const liabilities = generateLiabilities(uid).slice(0, 2);
  await batchWrite(uid, 'liabilities', liabilities);
  counts['liabilities'] = liabilities.length;

  // 4. Tracked Payments
  const trackedPayments = generateTrackedPayments(uid).slice(0, 4);
  await batchWrite(uid, 'trackedPayments', trackedPayments);
  counts['trackedPayments'] = trackedPayments.length;

  // 5. Pending Payments (Receivables)
  const pendingPayments = generatePendingPayments(uid).slice(0, 3);
  await batchWrite(uid, 'pendingPayments', pendingPayments);
  counts['pendingPayments'] = pendingPayments.length;

  // 6. Cashflows
  const cashflowItems = generateCashflows().slice(0, 8);
  const cashflowDocs = cashflowItems.map((cf) => ({
    ...cf, userId: uid,
  }));
  await batchWrite(uid, 'cashflows', cashflowDocs);
  counts['cashflows'] = cashflowDocs.length;

  // 7. Goals
  const goals = generateGoals(uid).slice(0, 3);
  await batchWrite(uid, 'goals', goals);
  counts['goals'] = goals.length;

  // 8. Goal Contributions
  const contributions = generateGoalContributions(uid).slice(0, 5);
  await batchWrite(uid, 'goalContributions', contributions);
  counts['goalContributions'] = contributions.length;

  // 9. Insurance Policies
  const policies = generateInsurancePolicies(uid).slice(0, 2);
  await batchWrite(uid, 'insurancePolicies', policies);
  counts['insurancePolicies'] = policies.length;

  // 10. Insurance Payments
  const insPayments = generateInsurancePayments(uid).slice(0, 1);
  await batchWrite(uid, 'insurancePayments', insPayments);
  counts['insurancePayments'] = insPayments.length;

  // 11. Lending Borrowers
  const borrowers = generateLendingBorrowers(uid).slice(0, 2);
  await batchWrite(uid, 'lendingBorrowers', borrowers);
  counts['lendingBorrowers'] = borrowers.length;

  // 12. Lending Transactions
  const transactions = generateLendingTransactions(uid).slice(0, 3);
  await batchWrite(uid, 'lendingTransactions', transactions);
  counts['lendingTransactions'] = transactions.length;

  // 13. Credentials
  const credentials = generateCredentials(uid).slice(0, 2);
  await batchWrite(uid, 'credentials', credentials);
  counts['credentials'] = credentials.length;

  // 14. Agriculture - Fields (use deterministic IDs)
  const fields = generateFields().slice(0, 4);
  const fieldIds = [FLD.tomato, FLD.coconut, FLD.dairy, FLD.sugarcane];
  const fieldDocs = fields.map((f, i) => ({
    id: fieldIds[i], ...f, createdAt: past(365), updatedAt: today, userId: uid,
  }));
  await batchWrite(uid, 'agriFields', fieldDocs);
  counts['agriFields'] = fieldDocs.length;

  // 15. Agriculture - Crop Cycles (no slice so all cross-references stay valid)
  const cropCycles = generateCropCycles(uid);
  await batchWrite(uid, 'agriCropCycles', cropCycles);
  counts['agriCropCycles'] = cropCycles.length;

  // 16. Agriculture - Expenses
  const agriExpenses = generateAgriExpenses(uid).slice(0, 5);
  await batchWrite(uid, 'agriExpenses', agriExpenses);
  counts['agriExpenses'] = agriExpenses.length;

  // 17. Agriculture - Milk Records
  const milkRecords = generateMilkRecords(uid).slice(0, 4);
  await batchWrite(uid, 'agriMilkRecords', milkRecords);
  counts['agriMilkRecords'] = milkRecords.length;

  // 18. Agriculture - Coconut Records
  const coconutRecords = generateCoconutRecords(uid).slice(0, 1);
  await batchWrite(uid, 'agriCoconut', coconutRecords);
  counts['agriCoconut'] = coconutRecords.length;

  // 19. Agriculture - Livestock Events
  const livestockEvents = generateLivestockEvents(uid).slice(0, 2);
  await batchWrite(uid, 'agriLivestockEvents', livestockEvents);
  counts['agriLivestockEvents'] = livestockEvents.length;

  // 20. Agriculture - Produce Sales
  const produceSales = generateProduceSales(uid).slice(0, 2);
  await batchWrite(uid, 'agriProduceSales', produceSales);
  counts['agriProduceSales'] = produceSales.length;

  // 21. Attendance - Employees (use deterministic IDs so records/transactions/salary can reference them)
  const employees = generateEmployees();
  const empKeys = ['ravi', 'suresh', 'karthik', 'mohan', 'ganesh'] as const;
  const empDocs = employees.map((e, i) => ({
    id: EMP[empKeys[i]], ...e, createdAt: past(365), updatedAt: today, userId: uid,
  }));
  await batchWrite(uid, 'attEmployees', empDocs);
  counts['attEmployees'] = empDocs.length;

  // 22. Attendance - Records
  const attRecords = generateAttendanceRecords(uid).slice(0, 10);
  await batchWrite(uid, 'attRecords', attRecords);
  counts['attRecords'] = attRecords.length;

  // 23. Attendance - Transactions
  const attTransactions = generateAttendanceTransactions(uid).slice(0, 3);
  await batchWrite(uid, 'attTransactions', attTransactions);
  counts['attTransactions'] = attTransactions.length;

  // 24. Attendance - Salary Records
  const salaryRecords = generateSalaryRecords(uid).slice(0, 3);
  await batchWrite(uid, 'attSalary', salaryRecords);
  counts['attSalary'] = salaryRecords.length;

  // 25. Portfolio Snapshots
  const snapshots = [];
  for (let i = 0; i < 5; i++) {
    snapshots.push({
      id: `snap_${format(subMonths(now(), i), 'yyyy-MM-dd')}`,
      date: format(subMonths(now(), i), 'yyyy-MM-dd'),
      totalValue: 500000 + i * 25000,
      userId: uid,
    });
  }
  await batchWrite(uid, 'snapshots', snapshots);
  counts['snapshots'] = snapshots.length;

  // 26. Net Worth Snapshots
  const nwSnapshots = [];
  for (let i = 0; i < 3; i++) {
    nwSnapshots.push({
      id: `networthSnapshot_${format(subMonths(now(), i * 5), 'yyyy-MM-dd')}`,
      createdAt: format(subMonths(now(), i * 5), 'yyyy-MM-dd'),
      totalAssets: 1500000 + i * 50000,
      totalLiabilities: 450000 - i * 5000,
      netWorth: 1050000 + i * 55000,
      userId: uid,
    });
  }
  await batchWrite(uid, 'networthSnapshots', nwSnapshots);
  counts['networthSnapshots'] = nwSnapshots.length;

  // 27. Ledger Entries
  const ledgerEntries: LedgerEntry[] = [];

  for (const cf of cashflowDocs.slice(0, 7)) {
    ledgerEntries.push({
      id: `ledger_cf_${cf.id}`, type: cf.type, date: cf.date, amount: cf.amount,
      category: cf.category, accountId: cf.accountId, module: 'personal',
      sourceType: 'manual', sourceId: cf.id, userId: uid,
      createdAt: cf.createdAt, updatedAt: today,
    });
  }

  for (const ae of agriExpenses.slice(0, 3)) {
    ledgerEntries.push({
      id: `ledger_agriculture_expense_${ae.id}`, type: 'expense', date: ae.date, amount: ae.amount,
      category: `Agri ${ae.category}`, module: 'agriculture', sourceType: 'agriculture_expense',
      sourceId: ae.id, userId: uid, createdAt: ae.createdAt, updatedAt: today,
    });
  }

  for (const ps of produceSales.slice(0, 1)) {
    ledgerEntries.push({
      id: `ledger_agriculture_sale_${ps.id}`, type: 'income', date: ps.date, amount: ps.totalAmount,
      category: `Crop Sale - ${ps.produceName}`, module: 'agriculture', sourceType: 'agriculture_sale',
      sourceId: ps.id, userId: uid, createdAt: ps.createdAt, updatedAt: today,
    });
  }

  for (const mr of milkRecords.slice(0, 1)) {
    ledgerEntries.push({
      id: `ledger_dairy_sale_${mr.id}`, type: 'income', date: mr.date,
      amount: mr.liters * mr.pricePerLiter, category: 'Dairy Milk Sale',
      module: 'agriculture', sourceType: 'dairy_sale', sourceId: mr.id,
      userId: uid, createdAt: mr.createdAt, updatedAt: today,
    });
  }

  await batchWrite(uid, 'ledgerEntries', ledgerEntries);
  counts['ledgerEntries'] = ledgerEntries.length;

  counts['total'] = Object.values(counts).reduce((a, b) => a + b, 0) - (counts['total'] || 0);
  counts['grandTotal'] = Object.values(counts).reduce((a, b) => a + b, 0);

  return { success: true, message: `Loaded ${counts['grandTotal']} dummy records across ${Object.keys(counts).length - 1} collections`, counts };
}

export function getDummyDataPreview(): Record<string, number> {
  const counts: Record<string, number> = {};
  counts['accounts'] = 2;
  counts['investments'] = 5;
  counts['liabilities'] = 2;
  counts['trackedPayments'] = 4;
  counts['pendingPayments'] = 3;
  counts['cashflows'] = 7;
  counts['goals'] = 3;
  counts['goalContributions'] = 5;
  counts['insurancePolicies'] = 2;
  counts['insurancePayments'] = 1;
  counts['lendingBorrowers'] = 2;
  counts['lendingTransactions'] = 3;
  counts['credentials'] = 2;
  counts['agriFields'] = 4;
  counts['agriCropCycles'] = 4;
  counts['agriExpenses'] = 5;
  counts['agriMilkRecords'] = 4;
  counts['agriCoconut'] = 1;
  counts['agriLivestockEvents'] = 2;
  counts['agriProduceSales'] = 2;
  counts['attEmployees'] = 5;
  counts['attRecords'] = 10;
  counts['attTransactions'] = 3;
  counts['attSalary'] = 3;
  counts['snapshots'] = 5;
  counts['networthSnapshots'] = 3;
  counts['ledgerEntries'] = 17;
  counts['grandTotal'] = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}
