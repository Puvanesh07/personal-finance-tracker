// My Farm — farmer-friendly setup (what you grow, harvest dates, animals)

import { formatNumber } from '../../utils/format';
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
  { value: 'existing', label: 'I already have them' },
  { value: 'purchase', label: 'Bought new' },
  { value: 'birth', label: 'New birth' },
  { value: 'sale', label: 'Sold' },
  { value: 'death', label: 'Lost / died' },
];

export const CROP_PRESETS: {
  name: string;
  emoji: string;
  days: number;
  hint: string;
}[] = [
  { name: 'Tomato', emoji: '🍅', days: 105, hint: '~3.5 months' },
  { name: 'Mango', emoji: '🥭', days: 150, hint: '~5 months' },
  { name: 'Drumstick', emoji: '🌿', days: 365, hint: 'Year-round tree' },
  { name: 'Coconut', emoji: '🌴', days: 3650, hint: 'Long-term trees' },
  { name: 'Paddy', emoji: '🌾', days: 120, hint: '~4 months' },
  { name: 'Chilli', emoji: '🌶️', days: 90, hint: '~3 months' },
  { name: 'Onion', emoji: '🧅', days: 100, hint: '~3 months' },
  { name: 'Banana', emoji: '🍌', days: 365, hint: 'Perennial' },
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

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
  );
}

function formatDateLong(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function findPresetDays(cropName: string): number | null {
  const lower = cropName.toLowerCase();
  const preset = CROP_PRESETS.find((p) => lower.includes(p.name.toLowerCase()));
  return preset?.days ?? null;
}

export function PlantationsTab({
  onGoToLedger,
}: {
  onGoToLedger?: () => void;
}) {
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
    deleteLivestockEvent,
  } = useAgriStore();

  const { cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();
  const { busy, run } = useAsyncAction();

  const [showCropModal, setShowCropModal] = useState(false);
  const [showLivestockModal, setShowLivestockModal] = useState(false);
  const [showLandModal, setShowLandModal] = useState(false);
  const [editingCrop, setEditingCrop] = useState<CropCycle | null>(null);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [showLandSection, setShowLandSection] = useState(false);

  const [cCrop, setCCrop] = useState('');
  const [cLand, setCLand] = useState('');
  const [cStart, setCStart] = useState(new Date().toISOString().split('T')[0]);
  const [cHarvest, setCHarvest] = useState('');
  const [cInvested, setCInvested] = useState('0');
  const [cField, setCField] = useState('');

  const [fName, setFName] = useState('');
  const [fArea, setFArea] = useState('0');
  const [fLocation, setFLocation] = useState('');

  const [animalType, setAnimalType] = useState<LivestockType>('cow');
  const [eventType, setEventType] = useState<LivestockEventType>('existing');
  const [evCount, setEvCount] = useState('1');
  const [evPrice, setEvPrice] = useState('0');
  const [evDate, setEvDate] = useState(new Date().toISOString().split('T')[0]);
  const [evNotes, setEvNotes] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const activeCrops = cropCycles.filter((c) => !c.actualHarvestDate);
  const cowCount = useMemo(
    () => calcCount(livestockEvents, 'cow'),
    [livestockEvents],
  );

  const harvestPreview = useMemo(() => {
    if (!cStart || !cHarvest) return null;
    const totalDays = daysBetween(cStart, cHarvest);
    const daysLeft = daysBetween(today, cHarvest);
    return {
      totalDays,
      daysLeft,
      harvestLabel: formatDateLong(cHarvest),
      plantedLabel: formatDateLong(cStart),
      overdue: daysLeft < 0,
    };
  }, [cStart, cHarvest, today]);

  function calcCount(events: LivestockEvent[], type: LivestockType) {
    return events
      .filter((e) => e.animalType === type)
      .reduce((total, e) => {
        if (['purchase', 'birth', 'existing'].includes(e.eventType))
          return total + e.count;
        if (['sale', 'death'].includes(e.eventType)) return total - e.count;
        return total;
      }, 0);
  }

  function applyPreset(preset: (typeof CROP_PRESETS)[number]) {
    setCCrop(preset.name);
    setCHarvest(addDays(cStart, preset.days));
  }

  function applyHarvestFromName(name: string, start: string) {
    const days = findPresetDays(name);
    if (days && start) setCHarvest(addDays(start, days));
  }

  function openAddCrop() {
    setEditingCrop(null);
    setCCrop('');
    setCLand('');
    setCStart(today);
    setCHarvest('');
    setCInvested('0');
    setCField(fields[0]?.id ?? '');
    setShowCropModal(true);
  }

  function openEditCrop(c: CropCycle) {
    setEditingCrop(c);
    setCCrop(c.cropName);
    setCLand(c.fieldName ?? '');
    setCStart(c.startDate);
    setCHarvest(c.expectedHarvestDate);
    setCInvested(String(c.investedAmount));
    setCField(c.fieldId ?? '');
    setShowCropModal(true);
  }

  const saveCrop = () =>
    void run(async () => {
      if (!cCrop.trim()) {
        toast.error('Enter what you are growing (e.g. Mango, Tomato)');
        return;
      }
      if (!cStart) {
        toast.error('When did you plant or start?');
        return;
      }
      let harvest = cHarvest;
      if (!harvest) {
        const days = findPresetDays(cCrop);
        harvest = days ? addDays(cStart, days) : addDays(cStart, 90);
      }

      let fieldId = cField;
      let fieldName = fields.find((f) => f.id === cField)?.name;
      if (cLand.trim() && !fieldId) {
        const existing = fields.find(
          (f) => f.name.toLowerCase() === cLand.trim().toLowerCase(),
        );
        if (existing) {
          fieldId = existing.id;
          fieldName = existing.name;
        } else {
          await addField({
            name: cLand.trim(),
            areAcres: 0,
          });
          const newField = useAgriStore.getState().fields.at(-1);
          fieldId = newField?.id ?? '';
          fieldName = cLand.trim();
        }
      }

      const invested = parseFloat(cInvested) || 0;
      const payload = {
        fieldId: fieldId || '',
        fieldName: fieldName || cLand.trim() || undefined,
        cropName: cCrop.trim(),
        season: inferSeason(cStart),
        startDate: cStart,
        expectedHarvestDate: harvest,
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
          `${cCrop.trim()} starting cost`,
        );
        toast.success('Updated ✓');
      } else {
        await addCropCycle(payload);
        if (invested > 0) {
          await pushToCashflow(
            'expense',
            'Crop Investment',
            invested,
            cStart,
            '',
            `${cCrop.trim()} starting cost`,
            addCashflow,
          );
        }
        toast.success(`${cCrop.trim()} added — harvest around ${formatDateLong(harvest)}`);
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
    toast.success('Removed');
  }

  const saveLivestock = () =>
    void run(async () => {
      const count = parseInt(evCount) || 1;
      const price = parseFloat(evPrice) || 0;
      if (count <= 0) {
        toast.error('Enter how many animals');
        return;
      }
      await addLivestockEvent({
        animalType,
        eventType,
        count,
        price: price > 0 ? price : undefined,
        notes: evNotes.trim() || undefined,
        date: evDate,
      });
      if (eventType === 'purchase' && price > 0) {
        await pushToCashflow(
          'expense',
          'Livestock Purchase',
          price,
          evDate,
          '',
          `Bought ${count} ${animalType}(s)`,
          addCashflow,
        );
      }
      toast.success('Saved ✓');
      setShowLivestockModal(false);
    });

  const saveField = () =>
    void run(async () => {
      if (!fName.trim()) {
        toast.error('Land / plot name required');
        return;
      }
      const payload = {
        name: fName.trim(),
        areAcres: parseFloat(fArea) || 0,
        location: fLocation.trim() || undefined,
      };
      if (editingField) {
        await updateField(editingField.id, payload);
      } else {
        await addField(payload);
      }
      toast.success('Land saved ✓');
      setShowLandModal(false);
      setEditingField(null);
    });

  return (
    <div className='flex flex-col gap-6'>
      <div className='rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4'>
        <h2 className='text-base font-bold text-slate-900 dark:text-white'>
          🌱 My Farm — what are you growing?
        </h2>
        <p className='mt-1 text-sm text-slate-600 dark:text-slate-400'>
          Add mango, tomato, drumstick, or dairy. We predict your harvest date
          automatically. Then go to <strong>Farm Ledger</strong> to log daily
          sales and expenses.
        </p>
        <button
          type='button'
          onClick={openAddCrop}
          className='mt-3 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700'
        >
          + Add what I&apos;m growing
        </button>
      </div>

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <SummaryCard
          icon='🌾'
          label='Growing now'
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
          icon='🏞️'
          label='Land plots'
          value={String(fields.length)}
          color='#3b82f6'
        />
        <SummaryCard
          icon='📋'
          label='Total registered'
          value={String(cropCycles.length)}
          color='#a78bfa'
        />
      </div>

      {/* Active crops with harvest countdown */}
      <section className='rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'>
        <h3 className='mb-3 text-sm font-bold'>🌾 Currently on my farm</h3>
        {activeCrops.length === 0 ? (
          <p className='py-6 text-center text-sm text-slate-500'>
            Nothing registered yet. Tap &quot;Add what I&apos;m growing&quot; above —
            e.g. Mango, Tomato, Drumstick.
          </p>
        ) : (
          <div className='space-y-2'>
            {activeCrops.map((c) => {
              const daysLeft = daysBetween(today, c.expectedHarvestDate);
              const progress = c.startDate
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      (daysBetween(c.startDate, today) /
                        Math.max(1, daysBetween(c.startDate, c.expectedHarvestDate))) *
                        100,
                    ),
                  )
                : 0;
              return (
                <div
                  key={c.id}
                  className='rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50'
                >
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div>
                      <p className='text-base font-bold text-emerald-700 dark:text-emerald-400'>
                        {c.cropName}
                        {c.fieldName ? ` · ${c.fieldName}` : ''}
                      </p>
                      <p className='text-xs text-slate-500'>
                        Planted {formatDateLong(c.startDate)}
                      </p>
                      <p className='mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200'>
                        🎯 Harvest around:{' '}
                        {formatDateLong(c.expectedHarvestDate)}
                      </p>
                      <p
                        className={`text-xs font-bold ${daysLeft <= 0 ? 'text-amber-500' : 'text-blue-500'}`}
                      >
                        {daysLeft <= 0
                          ? `Harvest time — ${Math.abs(daysLeft)} days past expected`
                          : `${daysLeft} days left`}
                      </p>
                    </div>
                    <div className='flex gap-2'>
                      <button
                        type='button'
                        onClick={() => openEditCrop(c)}
                        className='text-xs font-bold text-blue-500'
                      >
                        Edit
                      </button>
                      <DeleteBtn onDelete={() => handleDeleteCrop(c)} />
                    </div>
                  </div>
                  <div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700'>
                    <div
                      className='h-full rounded-full bg-emerald-500 transition-all'
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Animals */}
      <section className='rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'>
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='text-sm font-bold'>🐄 My animals</h3>
          <button
            type='button'
            onClick={() => setShowLivestockModal(true)}
            className='rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-bold text-white'
          >
            + Add animals
          </button>
        </div>
        <p className='mb-3 text-xs text-slate-500'>
          Register cows you already have, then log morning &amp; evening milk in
          Farm Ledger → Dairy.
        </p>
        {livestockEvents.length === 0 ? (
          <p className='py-4 text-center text-xs text-slate-500'>No animals yet.</p>
        ) : (
          <div className='space-y-2'>
            {livestockEvents.slice(0, 8).map((e) => (
              <div
                key={e.id}
                className='flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50'
              >
                <span>
                  {LIVESTOCK_TYPES.find((t) => t.value === e.animalType)?.emoji}{' '}
                  {e.count} {e.animalType} —{' '}
                  {EVENT_TYPES.find((t) => t.value === e.eventType)?.label}
                </span>
                <DeleteBtn
                  onDelete={async () => {
                    await deleteLivestockEvent(e.id);
                    toast.success('Removed');
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Optional land — collapsed */}
      <section className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700'>
        <button
          type='button'
          onClick={() => setShowLandSection((v) => !v)}
          className='flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-slate-600 dark:text-slate-400'
        >
          <span>🏞️ Optional: Land / plot details</span>
          <span>{showLandSection ? '▲' : '▼'}</span>
        </button>
        {showLandSection && (
          <div className='border-t border-slate-200 px-4 pb-4 pt-2 dark:border-slate-800'>
            <p className='mb-3 text-xs text-slate-500'>
              Only if you want to track acres per plot. You can also just type plot
              name when adding a crop.
            </p>
            <button
              type='button'
              onClick={() => {
                setEditingField(null);
                setFName('');
                setFArea('0');
                setFLocation('');
                setShowLandModal(true);
              }}
              className='mb-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white'
            >
              + Add land plot
            </button>
            {fields.map((f) => (
              <div
                key={f.id}
                className='mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50'
              >
                <span className='text-sm'>
                  {f.name}
                  {f.areAcres > 0 ? ` · ${formatNumber(f.areAcres, 1)} acres` : ''}
                </span>
                <DeleteBtn
                  onDelete={async () => {
                    await deleteField(f.id);
                    toast.success('Removed');
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {onGoToLedger && (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4'>
          <div>
            <p className='text-sm font-bold text-slate-900 dark:text-white'>
              Ready to log sales &amp; expenses?
            </p>
            <p className='text-xs text-slate-600 dark:text-slate-400'>
              After registering crops here, record daily harvest, milk &amp; costs in Farm Ledger.
            </p>
          </div>
          <button
            type='button'
            onClick={onGoToLedger}
            className='shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700'
          >
            Go to Farm Ledger →
          </button>
        </div>
      )}

      {/* Add / edit crop modal — farmer simple */}
      <Modal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        title={editingCrop ? 'Edit crop' : 'What are you growing?'}
      >
        <div className='flex flex-col gap-4'>
          <div>
            <label className={labelCls}>Quick pick</label>
            <div className='flex flex-wrap gap-2'>
              {CROP_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type='button'
                  onClick={() => applyPreset(p)}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition-all ${
                    cCrop.toLowerCase() === p.name.toLowerCase()
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  {p.emoji} {p.name}
                  <span className='ml-1 text-[10px] font-normal opacity-70'>
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Crop / tree name *</label>
            <input
              className={inputCls}
              value={cCrop}
              onChange={(e) => {
                setCCrop(e.target.value);
                applyHarvestFromName(e.target.value, cStart);
              }}
              placeholder='Mango, Tomato, Drumstick…'
            />
          </div>

          <div>
            <label className={labelCls}>Plot / land name (optional)</label>
            <input
              className={inputCls}
              value={cLand}
              onChange={(e) => setCLand(e.target.value)}
              placeholder='North field, Home garden…'
              list='land-names'
            />
            <datalist id='land-names'>
              {fields.map((f) => (
                <option key={f.id} value={f.name} />
              ))}
            </datalist>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div>
              <label className={labelCls}>Planted / started on *</label>
              <input
                type='date'
                className={inputCls}
                value={cStart}
                onChange={(e) => {
                  setCStart(e.target.value);
                  applyHarvestFromName(cCrop, e.target.value);
                }}
              />
            </div>
            <div>
              <label className={labelCls}>Expected harvest date</label>
              <input
                type='date'
                className={inputCls}
                value={cHarvest}
                onChange={(e) => setCHarvest(e.target.value)}
              />
              <p className='mt-1 text-[10px] text-slate-500'>
                Auto-filled from crop type — you can change it
              </p>
            </div>
          </div>

          {harvestPreview && (
            <div className='rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4'>
              <p className='text-sm font-bold text-emerald-800 dark:text-emerald-200'>
                📅 Harvest prediction
              </p>
              <p className='mt-1 text-sm text-slate-700 dark:text-slate-200'>
                Planted: {harvestPreview.plantedLabel}
              </p>
              <p className='text-sm font-semibold text-emerald-700 dark:text-emerald-300'>
                Expected harvest: {harvestPreview.harvestLabel}
              </p>
              <p className='text-xs text-slate-600 dark:text-slate-400'>
                Growing period: {harvestPreview.totalDays} days ·{' '}
                {harvestPreview.overdue
                  ? `${Math.abs(harvestPreview.daysLeft)} days past harvest`
                  : `${harvestPreview.daysLeft} days remaining`}
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Money spent to start (₹, optional)</label>
            <NumericInput className={inputCls} value={cInvested} onChange={setCInvested} />
          </div>

          <button
            type='button'
            onClick={saveCrop}
            disabled={busy}
            className='inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50'
          >
            {busy && <ButtonSpinner />}
            {editingCrop ? 'Save changes' : 'Add to my farm'}
          </button>
        </div>
      </Modal>

      <Modal
        open={showLivestockModal}
        onClose={() => setShowLivestockModal(false)}
        title='Add animals'
      >
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
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
            <label className={labelCls}>What happened?</label>
            <AgriDropdown
              value={eventType}
              onChange={(v) => setEventType(v as LivestockEventType)}
              options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div>
            <label className={labelCls}>How many?</label>
            <NumericInput className={inputCls} value={evCount} onChange={setEvCount} />
          </div>
          <div>
            <label className={labelCls}>Amount (₹, if bought/sold)</label>
            <NumericInput className={inputCls} value={evPrice} onChange={setEvPrice} />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input
              type='date'
              className={inputCls}
              value={evDate}
              onChange={(e) => setEvDate(e.target.value)}
            />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Notes (optional)</label>
            <input
              className={inputCls}
              value={evNotes}
              onChange={(e) => setEvNotes(e.target.value)}
              placeholder='e.g. bought from local market'
            />
          </div>
          <button
            type='button'
            onClick={saveLivestock}
            disabled={busy}
            className='sm:col-span-2 rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white disabled:opacity-50'
          >
            Save
          </button>
        </div>
      </Modal>

      <Modal
        open={showLandModal}
        onClose={() => setShowLandModal(false)}
        title='Add land plot'
      >
        <div className='grid gap-4'>
          <div>
            <label className={labelCls}>Plot name *</label>
            <input className={inputCls} value={fName} onChange={(e) => setFName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Acres (optional)</label>
            <NumericInput className={inputCls} value={fArea} onChange={setFArea} />
          </div>
          <button
            type='button'
            onClick={saveField}
            disabled={busy}
            className='rounded-xl bg-blue-600 py-2 text-sm font-bold text-white'
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
