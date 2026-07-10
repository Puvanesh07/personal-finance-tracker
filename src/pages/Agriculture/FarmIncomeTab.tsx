// Unified farm income & expense — day-by-day ledger for all agriculture types

import { FiChevronDown, FiEdit2 } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { useMemo, useState } from 'react';
import {
  AgriDropdown,
  DeleteBtn,
  EXPENSE_CATS,
  SummaryCard,
  inputCls,
  labelCls,
} from './agriShared';
import {
  removeAgriCashflow,
  syncAgriCashflow,
} from '../../utils/agriCashflowSync';
import {
  buildFarmLedger,
  groupLedgerByDay,
  type FarmLedgerEntry,
  type LedgerSource,
} from '../../utils/agriLedger';
import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import type {
  AgriExpense,
  AgriExpenseCategory,
  CoconutRecord,
  CoconutSellMethod,
  ProduceSaleLot,
} from '../../types/investmentTypes';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { PlantationsTab } from './PlantationsTab';

const ENTRY_TYPES = [
  {
    value: 'produce',
    label: 'Harvest / Sale',
    emoji: '🧺',
    desc: 'Tomato, drumstick kg, fruits',
  },
  {
    value: 'expense',
    label: 'Crop Expense',
    emoji: '💸',
    desc: 'Fertilizer, labor, tractor',
  },
  {
    value: 'dairy',
    label: 'Dairy',
    emoji: '🐄',
    desc: 'Milk income + feed/vet expense — same day',
  },
  {
    value: 'coconut',
    label: 'Coconut',
    emoji: '🌴',
    desc: 'Harvest income & same-day cost',
  },
] as const;

type EntryKind = (typeof ENTRY_TYPES)[number]['value'];

const PRESET_UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'box', label: 'box' },
  { value: 'piece', label: 'piece' },
  { value: 'bunch', label: 'bunch' },
  { value: 'litre', label: 'litre' },
  { value: 'custom', label: 'Custom…' },
];

export function FarmIncomeTab() {
  const store = useAgriStore();
  const {
    cropCycles,
    agriExpenses,
    produceSales,
    milkRecords,
    coconutRecords,
    addAgriExpense,
    updateAgriExpense,
    deleteAgriExpense,
    addProduceSale,
    updateProduceSale,
    deleteProduceSale,
    addMilkRecord,
    updateMilkRecord,
    deleteMilkRecord,
    addCoconutRecord,
    updateCoconutRecord,
    deleteCoconutRecord,
  } = store;

  const { accounts, cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();
  const { busy, run } = useAsyncAction();

  const [showSetup, setShowSetup] = useState(false);
  const [filterPlantation, setFilterPlantation] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FarmLedgerEntry | null>(null);
  const [editingMilkId, setEditingMilkId] = useState<string | null>(null);
  const [editingDairyExpenseId, setEditingDairyExpenseId] = useState<
    string | null
  >(null);

  const [entryKind, setEntryKind] = useState<EntryKind>('produce');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [account, setAccount] = useState('');
  const [notes, setNotes] = useState('');

  // Produce
  const [pName, setPName] = useState('');
  const [pUnit, setPUnit] = useState('kg');
  const [pCustomUnit, setPCustomUnit] = useState('');
  const [pQty, setPQty] = useState('0');
  const [pPrice, setPPrice] = useState('0');
  const [pCommission, setPCommission] = useState('0');

  // Expense
  const [ePlantation, setEPlantation] = useState('');
  const [eCropId, setECropId] = useState('');
  const [eCat, setECat] = useState<AgriExpenseCategory>('fertilizer');
  const [eAmount, setEAmount] = useState('0');

  // Milk income
  const [mLiters, setMLiters] = useState('0');
  const [mPrice, setMPrice] = useState('0');

  // Coconut
  const [cTrees, setCTrees] = useState('0');
  const [cNuts, setCNuts] = useState('0');
  const [cPrice, setCPrice] = useState('0');
  const [cInvest, setCInvest] = useState('0');
  const [sellMethod, setSellMethod] = useState<CoconutSellMethod>('by_count');
  const [cTons, setCTons] = useState('0');
  const [cPriceTon, setCPriceTon] = useState('0');

  const ledger = useMemo(
    () =>
      buildFarmLedger({
        agriExpenses,
        produceSales,
        milkRecords,
        coconutRecords,
        livestockEvents: store.livestockEvents,
        cropCycles,
      }),
    [
      agriExpenses,
      produceSales,
      milkRecords,
      coconutRecords,
      store.livestockEvents,
      cropCycles,
    ],
  );

  const plantations = useMemo(() => {
    const fromCrops = cropCycles.map((c) => c.cropName);
    return Array.from(
      new Set([...fromCrops, 'Dairy', 'Coconut Grove', 'General Farm']),
    ).sort();
  }, [cropCycles]);

  const filtered = useMemo(() => {
    if (filterPlantation === 'all') return ledger;
    return ledger.filter((e) => e.plantation === filterPlantation);
  }, [ledger, filterPlantation]);

  const dayGroups = useMemo(() => groupLedgerByDay(filtered), [filtered]);

  const totals = useMemo(() => {
    const income = filtered
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + e.amount, 0);
    const expense = filtered
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  function resetForm() {
    setEntryKind('produce');
    setEditingMilkId(null);
    setEditingDairyExpenseId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setAccount('');
    setNotes('');
    setPName('');
    setPUnit('kg');
    setPCustomUnit('');
    setPQty('0');
    setPPrice('0');
    setPCommission('0');
    setEPlantation('');
    setECropId(cropCycles[0]?.id ?? '');
    setECat('fertilizer');
    setEAmount('0');
    setMLiters('0');
    setMPrice('0');
    setCTrees('0');
    setCNuts('0');
    setCPrice('0');
    setCInvest('0');
    setSellMethod('by_count');
    setCTons('0');
    setCPriceTon('0');
  }

  function loadDairyForDate(
    entryDate: string,
    milkRawId?: string,
    expenseRawId?: string,
  ) {
    setEntryKind('dairy');
    const m = milkRawId
      ? milkRecords.find((x) => x.id === milkRawId)
      : milkRecords.find((x) => x.date === entryDate);
    const dExp = expenseRawId
      ? agriExpenses.find((x) => x.id === expenseRawId)
      : agriExpenses.find(
          (e) => e.plantationLabel === 'Dairy' && e.date === entryDate,
        );
    setEditingMilkId(m?.id ?? null);
    setEditingDairyExpenseId(dExp?.id ?? null);
    setMLiters(String(m?.liters ?? 0));
    setMPrice(String(m?.pricePerLiter ?? 0));
    setECat(dExp?.category ?? 'feed');
    setEAmount(String(dExp?.amount ?? 0));
    setAccount(m?.accountId ?? dExp?.accountId ?? '');
    setNotes(dExp?.notes ?? m?.soldTo ?? '');
  }

  function loadEdit(entry: FarmLedgerEntry) {
    setEditing(entry);
    setDate(entry.date);
    if (entry.source === 'produce') {
      setEntryKind('produce');
      const p = produceSales.find((x) => x.id === entry.rawId);
      if (p) {
        setPName(p.produceName);
        setPUnit(p.unit);
        setPCustomUnit(p.customUnit ?? '');
        setPQty(String(p.quantity));
        setPPrice(String(p.pricePerUnit));
        setPCommission(String(p.commissionAmount ?? 0));
        setAccount(p.accountId ?? '');
        setNotes(p.notes ?? '');
      }
    } else if (entry.source === 'expense') {
      if (entry.plantation === 'Dairy') {
        loadDairyForDate(entry.date, undefined, entry.rawId);
      } else {
        setEntryKind('expense');
        const e = agriExpenses.find((x) => x.id === entry.rawId);
        if (e) {
          setECropId(e.cropCycleId ?? '');
          setEPlantation(e.plantationLabel ?? e.cropName ?? '');
          setECat(e.category);
          setEAmount(String(e.amount));
          setAccount(e.accountId ?? '');
          setNotes(e.notes ?? '');
        }
      }
    } else if (entry.source === 'milk') {
      loadDairyForDate(entry.date, entry.rawId);
    } else if (
      entry.source === 'coconut_income' ||
      entry.source === 'coconut_expense'
    ) {
      setEntryKind('coconut');
      const c = coconutRecords.find((x) => x.id === entry.rawId);
      if (c) {
        setCTrees(String(c.numberOfTrees));
        setCNuts(String(c.totalCoconuts));
        setCPrice(String(c.pricePerCoconut ?? 0));
        setCInvest(String(c.investmentAmount));
        setSellMethod(c.sellMethod);
        setCTons(String(c.totalTons ?? 0));
        setCPriceTon(String(c.pricePerTon ?? 0));
        setAccount(c.accountId ?? '');
        setNotes(c.notes ?? '');
      }
    }
    setShowModal(true);
  }

  async function handleDelete(entry: FarmLedgerEntry) {
    if (entry.source === 'produce') {
      const p = produceSales.find((x) => x.id === entry.rawId)!;
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'income',
        'produce',
        p.id,
        {
          category: 'Produce Sale',
          amount: p.totalAmount,
          date: p.date,
        },
      );
      await deleteProduceSale(p.id);
    } else if (entry.source === 'expense') {
      const e = agriExpenses.find((x) => x.id === entry.rawId)!;
      const cat =
        EXPENSE_CATS.find((c) => c.value === e.category)?.label ?? e.category;
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'expense',
        'expense',
        e.id,
        { category: cat, amount: e.amount, date: e.date },
      );
      await deleteAgriExpense(e.id);
    } else if (entry.source === 'milk') {
      const m = milkRecords.find((x) => x.id === entry.rawId)!;
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'income',
        'milk',
        m.id,
        {
          category: 'Dairy Income',
          amount: m.liters * m.pricePerLiter,
          date: m.date,
        },
      );
      await deleteMilkRecord(m.id);
    } else if (
      entry.source === 'coconut_income' ||
      entry.source === 'coconut_expense'
    ) {
      const c = coconutRecords.find((x) => x.id === entry.rawId)!;
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'income',
        'coconut',
        c.id,
        {
          category: 'Coconut Sale',
          amount: c.harvestIncome,
          date: c.date,
        },
      );
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'expense',
        'coconut',
        c.id,
        {
          category: 'Coconut Farm Expense',
          amount: c.investmentAmount,
          date: c.date,
        },
      );
      await deleteCoconutRecord(c.id);
    }
    toast.success('Entry deleted ✓');
  }

  async function saveProduce(): Promise<boolean> {
    const qty = parseFloat(pQty) || 0;
    const price = parseFloat(pPrice) || 0;
    const commission = parseFloat(pCommission) || 0;
    if (!pName.trim() || qty <= 0 || price <= 0) {
      toast.error('Produce name, qty and price required');
      return false;
    }
    const total = Math.max(0, qty * price - commission);
    const unit = pUnit === 'custom' ? pCustomUnit.trim() || 'unit' : pUnit;
    const payload: Omit<
      ProduceSaleLot,
      'id' | 'createdAt' | 'updatedAt' | 'userId'
    > = {
      produceName: pName.trim(),
      category: 'Vegetable',
      unit,
      customUnit: pUnit === 'custom' ? pCustomUnit.trim() : undefined,
      quantity: qty,
      pricePerUnit: price,
      commissionAmount: commission > 0 ? commission : undefined,
      totalAmount: total,
      date,
      notes: notes.trim() || undefined,
      accountId: account || undefined,
    };
    const note = `${pName} — ${qty} ${unit} × ₹${price}`;

    if (editing?.source === 'produce') {
      const old = produceSales.find((x) => x.id === editing.rawId)!;
      await updateProduceSale(old.id, payload);
      await syncAgriCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'income',
        'produce',
        old.id,
        'Produce Sale',
        total,
        date,
        account,
        note,
        {
          category: 'Produce Sale',
          amount: old.totalAmount,
          date: old.date,
        },
      );
    } else {
      const id = await addProduceSale(payload);
      if (id) {
        await syncAgriCashflow(
          cashflows,
          addCashflow,
          updateCashflow,
          deleteCashflow,
          'income',
          'produce',
          id,
          'Produce Sale',
          total,
          date,
          account,
          note,
        );
      }
    }
    toast.success('Produce sale saved ✓');
    return true;
  }

  async function saveExpense(): Promise<boolean> {
    const amount = parseFloat(eAmount) || 0;
    if (amount <= 0) {
      toast.error('Enter valid amount');
      return false;
    }
    const crop = cropCycles.find((c) => c.id === eCropId);
    const plantation = ePlantation.trim() || crop?.cropName || 'General Farm';
    const catLabel =
      EXPENSE_CATS.find((c) => c.value === eCat)?.label ?? eCat;
    const payload: Omit<
      AgriExpense,
      'id' | 'createdAt' | 'updatedAt' | 'userId'
    > = {
      cropCycleId: eCropId || undefined,
      cropName: crop?.cropName,
      plantationLabel: plantation,
      category: eCat,
      amount,
      date,
      notes: notes.trim() || undefined,
      accountId: account || undefined,
    };
    const cfNote = `Farm expense: ${catLabel} (${plantation})`;

    if (editing?.source === 'expense') {
      const old = agriExpenses.find((x) => x.id === editing.rawId)!;
      const oldCat =
        EXPENSE_CATS.find((c) => c.value === old.category)?.label ??
        old.category;
      await updateAgriExpense(old.id, payload);
      await syncAgriCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'expense',
        'expense',
        old.id,
        catLabel,
        amount,
        date,
        account,
        cfNote,
        { category: oldCat, amount: old.amount, date: old.date },
      );
    } else {
      const id = await addAgriExpense(payload);
      if (id) {
        await syncAgriCashflow(
          cashflows,
          addCashflow,
          updateCashflow,
          deleteCashflow,
          'expense',
          'expense',
          id,
          catLabel,
          amount,
          date,
          account,
          cfNote,
        );
      }
    }
    toast.success('Expense saved ✓');
    return true;
  }

  async function saveDairy(): Promise<boolean> {
    const liters = parseFloat(mLiters) || 0;
    const price = parseFloat(mPrice) || 0;
    const expAmount = parseFloat(eAmount) || 0;
    const income = liters * price;
    const catLabel =
      EXPENSE_CATS.find((c) => c.value === eCat)?.label ?? eCat;

    if (income <= 0 && expAmount <= 0) {
      toast.error('Enter milk income and/or dairy expense');
      return false;
    }

    let milkId = editingMilkId;
    if (income > 0) {
      const milkPayload = {
        date,
        liters,
        pricePerLiter: price,
        accountId: account || undefined,
      };
      if (milkId) {
        const old = milkRecords.find((x) => x.id === milkId)!;
        await updateMilkRecord(milkId, milkPayload);
        await syncAgriCashflow(
          cashflows,
          addCashflow,
          updateCashflow,
          deleteCashflow,
          'income',
          'milk',
          milkId,
          'Dairy Income',
          income,
          date,
          account,
          `Dairy: ${liters}L @ ₹${price}/L`,
          {
            category: 'Dairy Income',
            amount: old.liters * old.pricePerLiter,
            date: old.date,
          },
        );
      } else {
        milkId = (await addMilkRecord(milkPayload)) ?? null;
        if (milkId) {
          await syncAgriCashflow(
            cashflows,
            addCashflow,
            updateCashflow,
            deleteCashflow,
            'income',
            'milk',
            milkId,
            'Dairy Income',
            income,
            date,
            account,
            `Dairy: ${liters}L @ ₹${price}/L`,
          );
        }
      }
    } else if (milkId) {
      const old = milkRecords.find((x) => x.id === milkId)!;
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'income',
        'milk',
        milkId,
        {
          category: 'Dairy Income',
          amount: old.liters * old.pricePerLiter,
          date: old.date,
        },
      );
      await deleteMilkRecord(milkId);
    }

    let expenseId = editingDairyExpenseId;
    if (expAmount > 0) {
      const expPayload: Omit<
        AgriExpense,
        'id' | 'createdAt' | 'updatedAt' | 'userId'
      > = {
        plantationLabel: 'Dairy',
        category: eCat,
        amount: expAmount,
        date,
        notes: notes.trim() || undefined,
        accountId: account || undefined,
      };
      const cfNote = `Dairy expense: ${catLabel}`;
      if (expenseId) {
        const old = agriExpenses.find((x) => x.id === expenseId)!;
        const oldCat =
          EXPENSE_CATS.find((c) => c.value === old.category)?.label ??
          old.category;
        await updateAgriExpense(expenseId, expPayload);
        await syncAgriCashflow(
          cashflows,
          addCashflow,
          updateCashflow,
          deleteCashflow,
          'expense',
          'expense',
          expenseId,
          catLabel,
          expAmount,
          date,
          account,
          cfNote,
          { category: oldCat, amount: old.amount, date: old.date },
        );
      } else {
        expenseId = (await addAgriExpense(expPayload)) ?? null;
        if (expenseId) {
          await syncAgriCashflow(
            cashflows,
            addCashflow,
            updateCashflow,
            deleteCashflow,
            'expense',
            'expense',
            expenseId,
            catLabel,
            expAmount,
            date,
            account,
            cfNote,
          );
        }
      }
    } else if (expenseId) {
      const old = agriExpenses.find((x) => x.id === expenseId)!;
      const oldCat =
        EXPENSE_CATS.find((c) => c.value === old.category)?.label ??
        old.category;
      await removeAgriCashflow(
        cashflows,
        deleteCashflow,
        'expense',
        'expense',
        expenseId,
        { category: oldCat, amount: old.amount, date: old.date },
      );
      await deleteAgriExpense(expenseId);
    }

    toast.success('Dairy entry saved ✓');
    return true;
  }

  async function saveCoconut(): Promise<boolean> {
    const nuts = parseInt(cNuts) || 0;
    const price = parseFloat(cPrice) || 0;
    const invest = parseFloat(cInvest) || 0;
    const tons = parseFloat(cTons) || 0;
    const pTon = parseFloat(cPriceTon) || 0;
    const income =
      sellMethod === 'by_count' ? nuts * price : tons * pTon;
    if (income <= 0 && invest <= 0) {
      toast.error('Enter income or expense amount');
      return false;
    }

    const record: Omit<
      CoconutRecord,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    > = {
      date,
      numberOfTrees: parseInt(cTrees) || 0,
      totalCoconuts: sellMethod === 'by_count' ? nuts : 0,
      sellMethod,
      pricePerCoconut: sellMethod === 'by_count' ? price : undefined,
      totalTons: sellMethod === 'by_ton' ? tons : undefined,
      pricePerTon: sellMethod === 'by_ton' ? pTon : undefined,
      harvestIncome: income,
      investmentAmount: invest,
      durationMonths: 3,
      notes: notes.trim() || undefined,
      accountId: account || undefined,
    };

    if (
      editing?.source === 'coconut_income' ||
      editing?.source === 'coconut_expense'
    ) {
      const old = coconutRecords.find((x) => x.id === editing.rawId)!;
      await updateCoconutRecord(old.id, record);
      await syncAgriCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'income',
        'coconut',
        old.id,
        'Coconut Sale',
        income,
        date,
        account,
        'Coconut harvest',
        {
          category: 'Coconut Sale',
          amount: old.harvestIncome,
          date: old.date,
        },
      );
      await syncAgriCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'expense',
        'coconut',
        old.id,
        'Coconut Farm Expense',
        invest,
        date,
        account,
        'Coconut farm expense',
        {
          category: 'Coconut Farm Expense',
          amount: old.investmentAmount,
          date: old.date,
        },
      );
    } else {
      const id = await addCoconutRecord(record);
      if (id) {
        if (income > 0) {
          await syncAgriCashflow(
            cashflows,
            addCashflow,
            updateCashflow,
            deleteCashflow,
            'income',
            'coconut',
            id,
            'Coconut Sale',
            income,
            date,
            account,
            'Coconut harvest',
          );
        }
        if (invest > 0) {
          await syncAgriCashflow(
            cashflows,
            addCashflow,
            updateCashflow,
            deleteCashflow,
            'expense',
            'coconut',
            id,
            'Coconut Farm Expense',
            invest,
            date,
            account,
            'Coconut farm expense',
          );
        }
      }
    }
    toast.success('Coconut entry saved ✓');
    return true;
  }

  async function save(): Promise<boolean> {
    if (entryKind === 'produce') return saveProduce();
    if (entryKind === 'expense') return saveExpense();
    if (entryKind === 'dairy') return saveDairy();
    if (entryKind === 'coconut') return saveCoconut();
    return false;
  }

  const handleSave = () =>
    void run(async () => {
      const ok = await save();
      if (!ok) return;
      setShowModal(false);
      setEditing(null);
      resetForm();
    });

  const handleDeleteEntry = (entry: FarmLedgerEntry) =>
    void run(async () => {
      await handleDelete(entry);
    });

  const canEdit = (source: LedgerSource) =>
    source !== 'livestock';

  return (
    <div className='flex flex-col gap-6'>
      <button
        type='button'
        onClick={() => setShowSetup((v) => !v)}
        className='flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-left'
      >
        <span className='text-sm font-bold'>🌱 Plantation Setup (crops, fields, cows)</span>
        <FiChevronDown
          className={`h-4 w-4 transition-transform ${showSetup ? 'rotate-180' : ''}`}
        />
      </button>
      {showSetup && <PlantationsTab />}

      <p className='text-sm text-slate-600 dark:text-slate-400'>
        One entry per action — income &amp; expenses sync to Cashflow and
        Dashboard automatically.
      </p>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='💰'
          label='Income'
          value={formatINR(totals.income)}
          color='#22c55e'
        />
        <SummaryCard
          icon='💸'
          label='Expenses'
          value={formatINR(totals.expense)}
          color='#ef4444'
        />
        <SummaryCard
          icon='📈'
          label='Net'
          value={formatINR(totals.net)}
          color={totals.net >= 0 ? '#22c55e' : '#ef4444'}
        />
        <SummaryCard
          icon='📅'
          label='Days logged'
          value={String(dayGroups.length)}
          color='#3b82f6'
        />
      </div>

      <div className='flex flex-wrap gap-2 items-center justify-between'>
        <div className='w-48'>
          <AgriDropdown
            value={filterPlantation}
            onChange={setFilterPlantation}
            options={[
              { value: 'all', label: 'All Plantations' },
              ...plantations.map((p) => ({ value: p, label: p })),
            ]}
          />
        </div>
        <button
          type='button'
          disabled={busy}
          onClick={() => {
            setEditing(null);
            resetForm();
            setShowModal(true);
          }}
          className='px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50'
        >
          + Add Entry
        </button>
      </div>

      <div className='flex flex-col gap-4'>
        {dayGroups.length === 0 ? (
          <p className='text-center text-sm text-slate-500 py-12'>
            No entries yet. Add your first farm income or expense.
          </p>
        ) : (
          dayGroups.map((day) => (
            <div
              key={day.date}
              className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden'
            >
              <div className='flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800'>
                <div className='font-bold text-slate-900 dark:text-slate-100'>
                  📅 {day.date}
                </div>
                <div className='flex gap-4 text-xs font-mono'>
                  <span className='text-emerald-500'>
                    +{formatINR(day.income)}
                  </span>
                  <span className='text-red-400'>
                    −{formatINR(day.expense)}
                  </span>
                  <span
                    className={
                      day.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    = {formatINR(day.net)}
                  </span>
                </div>
              </div>
              <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                {day.entries.map((e) => (
                  <div
                    key={e.id}
                    className='flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  >
                    <div className='flex items-center gap-3 min-w-0'>
                      <span className='text-lg'>{e.emoji}</span>
                      <div className='min-w-0'>
                        <div className='text-sm font-semibold text-slate-900 dark:text-slate-100 truncate'>
                          {e.label}
                          <span className='ml-2 text-xs font-normal text-slate-500'>
                            {e.plantation}
                          </span>
                        </div>
                        {e.detail && (
                          <div className='text-xs text-slate-500 truncate'>
                            {e.detail}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-2 shrink-0'>
                      <span
                        className={`font-bold font-mono text-sm ${e.type === 'income' ? 'text-emerald-500' : 'text-red-400'}`}
                      >
                        {e.type === 'income' ? '+' : '−'}
                        {formatINR(e.amount)}
                      </span>
                      {canEdit(e.source) && (
                        <>
                          <button
                            type='button'
                            onClick={() => loadEdit(e)}
                            className='btn-icon btn-icon-edit h-8 w-8'
                            title='Edit'
                          >
                            <FiEdit2 className='w-3.5 h-3.5' />
                          </button>
                          <DeleteBtn
                            onDelete={() => handleDeleteEntry(e)}
                            disabled={busy}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        title={editing ? '✏️ Edit Entry' : '➕ Add Farm Income / Expense'}
      >
        {!editing && (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4'>
            {ENTRY_TYPES.map((t) => (
              <button
                key={t.value}
                type='button'
                onClick={() => setEntryKind(t.value)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  entryKind === t.value
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className='font-bold text-sm'>
                  {t.emoji} {t.label}
                </div>
                <div className='text-[10px] text-slate-500 mt-0.5'>{t.desc}</div>
              </button>
            ))}
          </div>
        )}

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Date *</label>
            <input
              type='date'
              className={inputCls}
              value={date}
              onChange={(ev) => setDate(ev.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Account</label>
            <AgriDropdown
              value={account}
              onChange={setAccount}
              options={[
                { value: '', label: '— Cash —' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>

          {entryKind === 'produce' && (
            <>
              <div>
                <label className={labelCls}>Produce / Crop *</label>
                <input
                  className={inputCls}
                  value={pName}
                  onChange={(ev) => setPName(ev.target.value)}
                  placeholder='Tomato, Drumstick, Onion…'
                />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                <AgriDropdown
                  value={pUnit}
                  onChange={setPUnit}
                  options={PRESET_UNITS}
                />
              </div>
              {pUnit === 'custom' && (
                <div>
                  <label className={labelCls}>Custom unit</label>
                  <input
                    className={inputCls}
                    value={pCustomUnit}
                    onChange={(ev) => setPCustomUnit(ev.target.value)}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Quantity *</label>
                <NumericInput className={inputCls} value={pQty} onChange={setPQty} />
              </div>
              <div>
                <label className={labelCls}>Price per unit (₹) *</label>
                <NumericInput className={inputCls} value={pPrice} onChange={setPPrice} />
              </div>
              <div>
                <label className={labelCls}>Commission (₹)</label>
                <NumericInput
                  className={inputCls}
                  value={pCommission}
                  onChange={setPCommission}
                />
              </div>
            </>
          )}

          {entryKind === 'expense' && (
            <>
              <div>
                <label className={labelCls}>Crop / Plantation</label>
                <AgriDropdown
                  value={eCropId}
                  onChange={setECropId}
                  options={[
                    { value: '', label: 'General (no crop)' },
                    ...cropCycles.map((c) => ({
                      value: c.id,
                      label: c.cropName,
                    })),
                  ]}
                />
              </div>
              <div>
                <label className={labelCls}>Plantation label</label>
                <input
                  className={inputCls}
                  value={ePlantation}
                  onChange={(ev) => setEPlantation(ev.target.value)}
                  placeholder='Tomato field, Drumstick grove…'
                />
              </div>
              <div>
                <label className={labelCls}>Category *</label>
                <AgriDropdown
                  value={eCat}
                  onChange={(v) => setECat(v as AgriExpenseCategory)}
                  options={EXPENSE_CATS.map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                />
              </div>
              <div>
                <label className={labelCls}>Amount (₹) *</label>
                <NumericInput className={inputCls} value={eAmount} onChange={setEAmount} />
              </div>
            </>
          )}

          {entryKind === 'dairy' && (
            <>
              <div className='sm:col-span-2 text-xs font-bold uppercase tracking-wider text-teal-500'>
                🥛 Milk income (optional)
              </div>
              <div>
                <label className={labelCls}>Liters</label>
                <NumericInput className={inputCls} value={mLiters} onChange={setMLiters} />
              </div>
              <div>
                <label className={labelCls}>Price per liter (₹)</label>
                <NumericInput className={inputCls} value={mPrice} onChange={setMPrice} />
              </div>
              <div className='sm:col-span-2 text-xs font-bold uppercase tracking-wider text-amber-500 mt-2'>
                🐄 Dairy expense (optional)
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <AgriDropdown
                  value={eCat}
                  onChange={(v) => setECat(v as AgriExpenseCategory)}
                  options={EXPENSE_CATS.filter((c) =>
                    ['feed', 'veterinary', 'medicine', 'shed', 'labor', 'other'].includes(
                      c.value,
                    ),
                  ).map((c) => ({ value: c.value, label: c.label }))}
                />
              </div>
              <div>
                <label className={labelCls}>Expense (₹)</label>
                <NumericInput className={inputCls} value={eAmount} onChange={setEAmount} />
              </div>
            </>
          )}

          {entryKind === 'coconut' && (
            <>
              <div>
                <label className={labelCls}>Trees</label>
                <NumericInput className={inputCls} value={cTrees} onChange={setCTrees} />
              </div>
              <div>
                <label className={labelCls}>Sell method</label>
                <AgriDropdown
                  value={sellMethod}
                  onChange={(v) => setSellMethod(v as CoconutSellMethod)}
                  options={[
                    { value: 'by_count', label: 'By count (nuts)' },
                    { value: 'by_ton', label: 'By ton' },
                  ]}
                />
              </div>
              {sellMethod === 'by_count' ? (
                <>
                  <div>
                    <label className={labelCls}>Total coconuts</label>
                    <NumericInput className={inputCls} value={cNuts} onChange={setCNuts} />
                  </div>
                  <div>
                    <label className={labelCls}>Price per coconut (₹)</label>
                    <NumericInput className={inputCls} value={cPrice} onChange={setCPrice} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Total tons</label>
                    <NumericInput className={inputCls} value={cTons} onChange={setCTons} />
                  </div>
                  <div>
                    <label className={labelCls}>Price per ton (₹)</label>
                    <NumericInput
                      className={inputCls}
                      value={cPriceTon}
                      onChange={setCPriceTon}
                    />
                  </div>
                </>
              )}
              <div>
                <label className={labelCls}>Same-day expense (₹)</label>
                <NumericInput className={inputCls} value={cInvest} onChange={setCInvest} />
              </div>
            </>
          )}

          <div className='sm:col-span-2'>
            <label className={labelCls}>Notes</label>
            <textarea
              className={inputCls + ' resize-none h-16'}
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
            />
          </div>
        </div>

        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-200 dark:border-slate-800'>
          <button
            type='button'
            onClick={() => {
              setShowModal(false);
              setEditing(null);
            }}
            className='px-4 py-2 rounded-xl text-slate-500 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSave}
            disabled={busy}
            className='px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50'
          >
            {busy ? 'Saving…' : editing ? 'Update' : 'Save'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
