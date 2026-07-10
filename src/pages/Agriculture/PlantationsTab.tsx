// Setup plantations: fields, crop cycles (tomato 90–120 days, drumstick), livestock

import { formatINR, formatNumber } from '../../utils/format';
import { useMemo, useState } from 'react';
import {
  AgriDropdown,
  DeleteBtn,
  LIVESTOCK_TYPES,
  SummaryCard,
  inputCls,
  labelCls,
  pushToCashflow,
  removeLinkedCashflow,
  syncCashflow,
} from './agriShared';
import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import type {
  CropCycle,
  Field,
  LivestockEvent,
  LivestockEventType,
  LivestockType,
  Season,
} from '../../types/investmentTypes';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { ButtonSpinner } from '../../components/ui/ButtonSpinner';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { usePortfolioStore } from '../../store/portfolioStore';

const EVENT_TYPES: { value: LivestockEventType; label: string }[] = [
  { value: 'existing', label: 'Already owned' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'birth', label: 'Birth' },
  { value: 'sale', label: 'Sale' },
  { value: 'death', label: 'Death' },
];

const CROP_PRESETS: { match: RegExp; days: number; label: string }[] = [
  { match: /tomato/i, days: 105, label: 'Tomato (~105 days)' },
  { match: /drumstick|moringa/i, days: 365, label: 'Drumstick (perennial)' },
  { match: /coconut/i, days: 3650, label: 'Coconut (long-term)' },
  { match: /paddy|rice/i, days: 120, label: 'Paddy (~120 days)' },
  { match: /chilli|chili/i, days: 90, label: 'Chilli (~90 days)' },
];

function inferSeason(startDate: string): Season {
  const month = new Date(startDate).getMonth();
  if (month >= 5 && month <= 9) return 'monsoon';
  if (month >= 10 || month <= 1) return 'winter';
  return 'summer';
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function PlantationsTab() {
  const {
    fields,
    cropCycles,
    livestockEvents,
    addField,
    updateField,
    deleteField,
    addCropCycle,
    updateCropCycle,
    deleteCropCycle,
    addLivestockEvent,
    updateLivestockEvent,
    deleteLivestockEvent,
  } = useAgriStore();

  const { cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();
  const { busy, run } = useAsyncAction();

  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showLivestockModal, setShowLivestockModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [editingCrop, setEditingCrop] = useState<CropCycle | null>(null);
  const [editingLivestock, setEditingLivestock] =
    useState<LivestockEvent | null>(null);

  const [fName, setFName] = useState('');
  const [fArea, setFArea] = useState('0');
  const [fLocation, setFLocation] = useState('');

  const [cField, setCField] = useState('');
  const [cCrop, setCCrop] = useState('');
  const [cStart, setCStart] = useState('');
  const [cHarvest, setCHarvest] = useState('');
  const [cInvested, setCInvested] = useState('0');

  const [animalType, setAnimalType] = useState<LivestockType>('cow');
  const [eventType, setEventType] = useState<LivestockEventType>('existing');
  const [evCount, setEvCount] = useState('1');
  const [evPrice, setEvPrice] = useState('0');
  const [evDate, setEvDate] = useState(new Date().toISOString().split('T')[0]);
  const [evNotes, setEvNotes] = useState('');
  const [evAccount, setEvAccount] = useState('');

  const cowCount = useMemo(() => calcCount(livestockEvents, 'cow'), [livestockEvents]);
  const activeCrops = cropCycles.filter((c) => !c.actualHarvestDate);

  function calcCount(events: LivestockEvent[], type: LivestockType) {
    return events
      .filter((e) => e.animalType === type)
      .reduce((total, e) => {
        if (
          e.eventType === 'purchase' ||
          e.eventType === 'birth' ||
          e.eventType === 'existing'
        )
          return total + e.count;
        if (e.eventType === 'sale' || e.eventType === 'death')
          return total - e.count;
        return total;
      }, 0);
  }

  function resetFieldForm(f?: Field) {
    setFName(f?.name ?? '');
    setFArea(String(f?.areAcres ?? 0));
    setFLocation(f?.location ?? '');
  }

  function resetCropForm(c?: CropCycle) {
    setCField(c?.fieldId ?? fields[0]?.id ?? '');
    setCCrop(c?.cropName ?? '');
    setCStart(c?.startDate ?? new Date().toISOString().split('T')[0]);
    setCHarvest(c?.expectedHarvestDate ?? '');
    setCInvested(String(c?.investedAmount ?? 0));
  }

  function applyCropPreset(name: string, startDate: string) {
    const preset = CROP_PRESETS.find((p) => p.match.test(name));
    if (preset && startDate) {
      setCHarvest(addDays(startDate, preset.days));
    }
  }

  function resetLivestockForm(ev?: LivestockEvent) {
    setAnimalType(ev?.animalType ?? 'cow');
    setEventType(ev?.eventType ?? 'existing');
    setEvCount(String(ev?.count ?? 1));
    setEvPrice(String(ev?.price ?? 0));
    setEvDate(ev?.date ?? new Date().toISOString().split('T')[0]);
    setEvNotes(ev?.notes ?? '');
    setEvAccount(ev?.accountId ?? '');
  }

  const saveField = () =>
    void run(async () => {
    if (!fName.trim()) {
      toast.error('Field name required');
      return;
    }
    const payload = {
      name: fName.trim(),
      areAcres: parseFloat(fArea) || 0,
      location: fLocation.trim() || undefined,
    };
    if (editingField) {
      await updateField(editingField.id, payload);
      toast.success('Field updated ✓');
    } else {
      await addField(payload);
      toast.success('Field added ✓');
    }
    setShowFieldModal(false);
    setEditingField(null);
  });

  const saveCrop = () =>
    void run(async () => {
    if (!cCrop.trim() || !cStart || !cHarvest) {
      toast.error('Crop name and dates required');
      return;
    }
    const fieldName = fields.find((f) => f.id === cField)?.name;
    const invested = parseFloat(cInvested) || 0;
    const season = cStart ? inferSeason(cStart) : 'monsoon';
    const payload = {
      fieldId: cField || '',
      fieldName,
      cropName: cCrop.trim(),
      season,
      startDate: cStart,
      expectedHarvestDate: cHarvest,
      investedAmount: invested,
      harvestIncome: 0,
      quantityKg: 0,
    };

    if (editingCrop) {
      await updateCropCycle(editingCrop.id, payload);
      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'expense',
        'Crop Investment',
        editingCrop.investedAmount,
        editingCrop.startDate,
        'Crop Investment',
        invested,
        cStart,
        '',
        `${cCrop.trim()} initial investment`,
      );
      toast.success('Crop cycle updated ✓');
    } else {
      await addCropCycle(payload);
      if (invested > 0) {
        await pushToCashflow(
          'expense',
          'Crop Investment',
          invested,
          cStart,
          '',
          `${cCrop.trim()} initial investment`,
          addCashflow,
        );
      }
      toast.success('Crop cycle added ✓');
    }
    setShowCropModal(false);
    setEditingCrop(null);
  });

  async function handleDeleteCrop(c: CropCycle) {
    if (c.investedAmount > 0)
      await removeLinkedCashflow(
        cashflows,
        deleteCashflow,
        'expense',
        'Crop Investment',
        c.investedAmount,
        c.startDate,
      );
    await deleteCropCycle(c.id);
    toast.success('Crop cycle deleted ✓');
  }

  const saveLivestock = () =>
    void run(async () => {
    const count = parseInt(evCount) || 1;
    const price = parseFloat(evPrice) || 0;
    if (count <= 0) {
      toast.error('Count must be at least 1');
      return;
    }
    const payload = {
      animalType,
      eventType,
      count,
      price: price > 0 ? price : undefined,
      accountId: evAccount || undefined,
      notes: evNotes.trim() || undefined,
      date: evDate,
    };

    if (editingLivestock) {
      await updateLivestockEvent(editingLivestock.id, payload);
      if (
        editingLivestock.price &&
        editingLivestock.price > 0 &&
        (editingLivestock.eventType === 'purchase' ||
          editingLivestock.eventType === 'sale')
      ) {
        const oldType =
          editingLivestock.eventType === 'purchase' ? 'expense' : 'income';
        const oldCat =
          editingLivestock.eventType === 'purchase'
            ? 'Livestock Purchase'
            : 'Livestock Sale';
        await removeLinkedCashflow(
          cashflows,
          deleteCashflow,
          oldType,
          oldCat,
          editingLivestock.price,
          editingLivestock.date,
        );
      }
      toast.success('Livestock event updated ✓');
    } else {
      await addLivestockEvent(payload);
      if (eventType === 'purchase' && price > 0) {
        await pushToCashflow(
          'expense',
          'Livestock Purchase',
          price,
          evDate,
          evAccount,
          `Bought ${count} ${animalType}(s)`,
          addCashflow,
        );
      }
      if (eventType === 'sale' && price > 0) {
        await pushToCashflow(
          'income',
          'Livestock Sale',
          price,
          evDate,
          evAccount,
          `Sold ${count} ${animalType}(s)`,
          addCashflow,
        );
      }
      toast.success('Livestock event added ✓');
    }
    setShowLivestockModal(false);
    setEditingLivestock(null);
  });

  return (
    <div className='flex flex-col gap-6'>
      <p className='text-sm text-slate-600 dark:text-slate-400'>
        Set up your farm units first — tomato crop (90–120 days), drumstick grove,
        coconut trees, or dairy cows. Then log daily income &amp; expenses in Farm
        Income.
      </p>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='🏞️'
          label='Fields'
          value={String(fields.length)}
          color='#3b82f6'
        />
        <SummaryCard
          icon='🌾'
          label='Active crops'
          value={String(activeCrops.length)}
          color='#22c55e'
        />
        <SummaryCard
          icon='🐄'
          label='Cows'
          value={String(Math.max(0, cowCount))}
          color='#14b8a6'
        />
        <SummaryCard
          icon='📋'
          label='Crop cycles'
          value={String(cropCycles.length)}
          color='#a78bfa'
        />
      </div>

      {/* Fields */}
      <section className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-sm font-bold'>🏞️ Fields</h3>
          <button
            type='button'
            onClick={() => {
              setEditingField(null);
              resetFieldForm();
              setShowFieldModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold'
          >
            + Add Field
          </button>
        </div>
        {fields.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>No fields yet.</p>
        ) : (
          <div className='space-y-2'>
            {fields.map((f) => (
              <div
                key={f.id}
                className='flex justify-between items-center rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3'
              >
                <div>
                  <div className='font-bold text-sm'>{f.name}</div>
                  <div className='text-xs text-slate-500'>
                    {formatNumber(f.areAcres, 2)} acres
                    {f.location ? ` · ${f.location}` : ''}
                  </div>
                </div>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setEditingField(f);
                      resetFieldForm(f);
                      setShowFieldModal(true);
                    }}
                    className='text-xs text-blue-500 font-bold'
                  >
                    Edit
                  </button>
                  <DeleteBtn
                    onDelete={async () => {
                      await deleteField(f.id);
                      toast.success('Field deleted');
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Crop cycles */}
      <section className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-sm font-bold'>🌾 Crop / Plantation Cycles</h3>
          <button
            type='button'
            onClick={() => {
              setEditingCrop(null);
              resetCropForm();
              setShowCropModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold'
          >
            + Add Crop
          </button>
        </div>
        {cropCycles.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>
            Add tomato, drumstick, or other crops with start &amp; harvest dates.
          </p>
        ) : (
          <div className='space-y-2'>
            {cropCycles.map((c) => {
              const days =
                c.startDate && c.expectedHarvestDate
                  ? Math.round(
                      (new Date(c.expectedHarvestDate).getTime() -
                        new Date(c.startDate).getTime()) /
                        86400000,
                    )
                  : 0;
              return (
                <div
                  key={c.id}
                  className='flex justify-between items-center rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3'
                >
                  <div>
                    <div className='font-bold text-sm text-emerald-600 dark:text-emerald-400'>
                      {c.cropName}
                      {c.fieldName ? ` · ${c.fieldName}` : ''}
                    </div>
                    <div className='text-xs text-slate-500'>
                      {c.startDate} → {c.expectedHarvestDate}
                      {days > 0 ? ` (${days} days)` : ''}
                      {c.investedAmount > 0
                        ? ` · Invested ${formatINR(c.investedAmount)}`
                        : ''}
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <button
                      type='button'
                      onClick={() => {
                        setEditingCrop(c);
                        resetCropForm(c);
                        setShowCropModal(true);
                      }}
                      className='text-xs text-blue-500 font-bold'
                    >
                      Edit
                    </button>
                    <DeleteBtn onDelete={() => handleDeleteCrop(c)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Livestock */}
      <section className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-sm font-bold'>🐄 Livestock (Cows &amp; others)</h3>
          <button
            type='button'
            onClick={() => {
              setEditingLivestock(null);
              resetLivestockForm();
              setShowLivestockModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold'
          >
            + Add Event
          </button>
        </div>
        <p className='text-xs text-slate-500 mb-3'>
          Register your 2 cows as &quot;Already owned&quot;, then log daily milk in Farm
          Income.
        </p>
        {livestockEvents.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>No livestock events.</p>
        ) : (
          <div className='space-y-2'>
            {livestockEvents.slice(0, 10).map((e) => (
              <div
                key={e.id}
                className='flex justify-between items-center rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm'
              >
                <span>
                  {LIVESTOCK_TYPES.find((t) => t.value === e.animalType)?.emoji}{' '}
                  {e.count}× {e.animalType} — {e.eventType} ({e.date})
                </span>
                <DeleteBtn
                  onDelete={async () => {
                    await deleteLivestockEvent(e.id);
                    toast.success('Deleted');
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Field modal */}
      <Modal
        open={showFieldModal}
        onClose={() => setShowFieldModal(false)}
        title={editingField ? 'Edit Field' : 'Add Field'}
      >
        <div className='grid gap-4'>
          <div>
            <label className={labelCls}>Name *</label>
            <input className={inputCls} value={fName} onChange={(e) => setFName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Area (acres)</label>
            <NumericInput className={inputCls} value={fArea} onChange={setFArea} />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input className={inputCls} value={fLocation} onChange={(e) => setFLocation(e.target.value)} />
          </div>
          <button type='button' onClick={saveField} disabled={busy} className='px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-50'>
            Save
          </button>
        </div>
      </Modal>

      {/* Crop modal */}
      <Modal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        title={editingCrop ? 'Edit Crop Cycle' : 'Add Crop / Plantation'}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Crop / Plantation name *</label>
            <input
              className={inputCls}
              value={cCrop}
              onChange={(e) => {
                const name = e.target.value;
                setCCrop(name);
                applyCropPreset(name, cStart);
              }}
              placeholder='Tomato, Drumstick, Coconut…'
              list='crop-presets'
            />
            <datalist id='crop-presets'>
              {CROP_PRESETS.map((p) => (
                <option key={p.label} value={p.label.split(' ')[0]} />
              ))}
            </datalist>
            <p className='mt-1 text-[11px] text-slate-500'>
              Harvest date auto-fills for common crops. Season is inferred from start date.
            </p>
          </div>
          {fields.length > 0 && (
            <div>
              <label className={labelCls}>Field (optional)</label>
              <AgriDropdown
                value={cField}
                onChange={setCField}
                options={fields.map((f) => ({ value: f.id, label: f.name }))}
                placeholder='Select field…'
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Start date *</label>
            <input
              type='date'
              className={inputCls}
              value={cStart}
              onChange={(e) => {
                const start = e.target.value;
                setCStart(start);
                applyCropPreset(cCrop, start);
              }}
            />
          </div>
          <div>
            <label className={labelCls}>Expected harvest *</label>
            <input type='date' className={inputCls} value={cHarvest} onChange={(e) => setCHarvest(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Initial investment (₹)</label>
            <NumericInput className={inputCls} value={cInvested} onChange={setCInvested} />
          </div>
          <button
            type='button'
            onClick={saveCrop}
            disabled={busy}
            className='sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50'
          >
            {busy && <ButtonSpinner />}
            Save Crop Cycle
          </button>
        </div>
      </Modal>

      {/* Livestock modal */}
      <Modal
        open={showLivestockModal}
        onClose={() => setShowLivestockModal(false)}
        title='Livestock Event'
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Animal</label>
            <AgriDropdown
              value={animalType}
              onChange={(v) => setAnimalType(v as LivestockType)}
              options={LIVESTOCK_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
                emoji: t.emoji,
              }))}
            />
          </div>
          <div>
            <label className={labelCls}>Event</label>
            <AgriDropdown
              value={eventType}
              onChange={(v) => setEventType(v as LivestockEventType)}
              options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div>
            <label className={labelCls}>Count</label>
            <NumericInput className={inputCls} value={evCount} onChange={setEvCount} />
          </div>
          <div>
            <label className={labelCls}>Price (₹)</label>
            <NumericInput className={inputCls} value={evPrice} onChange={setEvPrice} />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type='date' className={inputCls} value={evDate} onChange={(e) => setEvDate(e.target.value)} />
          </div>
          <button
            type='button'
            onClick={saveLivestock}
            disabled={busy}
            className='sm:col-span-2 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm disabled:opacity-50'
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
