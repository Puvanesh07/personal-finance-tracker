// src/pages/Agriculture/AttendancePage.tsx
// Simple 5-tab attendance: Dashboard · Employees · Attendance · Salary · Reports

import type {
  AttendanceEmployee,
  AttendanceRecord,
  PaymentStatus,
  SalaryRecord,
  TransactionType,
} from '../../types/investmentTypes';
import {
  autoSyncSalaryForDate,
  cleanupSalaryLinks,
  regenerateAllSalariesForMonth,
  regenerateSalaryForEmployee,
  syncSalaryPaymentToCashflow,
} from '../../utils/attendanceAgriSync';
import { SimpleMoneyFlow } from './agriShared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useEnsureAgriHydrated,
  useEnsureAttendanceHydrated,
} from '../../hooks/useDeferredStoreHydration';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import {
  createDefaultDateFilter,
  getDateRange,
  isDateInRange,
  type DateFilterState,
} from '../../utils/dateFilters';

import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Style constants ──────────────────────────────────────────────────────────
const inp =
  'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
const lbl =
  'block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().split('T')[0];
const curMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};
const months12 = () => {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
};

function getSyncStores() {
  return {
    att: useAttendanceStore.getState(),
    agri: useAgriStore.getState(),
    port: usePortfolioStore.getState(),
  };
}
const AVATAR_COLORS = [
  '#0F6E56',
  '#185FA5',
  '#854F0B',
  '#A32D2D',
  '#534AB7',
  '#3B6D11',
  '#993C1D',
];
const avatarColor = (i: number) => AVATAR_COLORS[i % AVATAR_COLORS.length];

// ── Mini components ──────────────────────────────────────────────────────────
function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div
      className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white'
      style={{ background: avatarColor(index) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function PayBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; cls: string }> = {
    paid: { label: '✓ Paid', cls: 'bg-emerald-500/10 text-emerald-400' },
    partially_paid: { label: 'Partial', cls: 'bg-amber-500/10 text-amber-400' },
    unpaid: { label: 'Unpaid', cls: 'bg-red-500/10 text-red-400' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

function ConfirmDelete({ onDelete }: { onDelete: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <div className='flex gap-1'>
      <button
        onClick={onDelete}
        className='rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white'
      >
        Yes, delete
      </button>
      <button
        onClick={() => setAsk(false)}
        className='rounded-lg bg-slate-300 dark:bg-slate-700 px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300'
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setAsk(true)}
      className='rounded-lg bg-slate-200 dark:bg-slate-800 px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-500/10'
    >
      Delete
    </button>
  );
}

// ── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'employees' | 'attendance' | 'salary' | 'reports';

// ════════════════════════════════════════════════════════════════════════════
// TAB 0 — DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function DashboardTab({ dateFilter }: { dateFilter: DateFilterState }) {
  const { employees, attendanceRecords, transactions, salaryRecords } =
    useAttendanceStore();

  const range = getDateRange(dateFilter);
  const todayStr = today();

  const filteredRecords = useMemo(
    () => attendanceRecords.filter((r) => isDateInRange(r.date, range)),
    [attendanceRecords, range],
  );
  const filteredTxns = useMemo(
    () => transactions.filter((t) => isDateInRange(t.date, range)),
    [transactions, range],
  );

  const presentToday = attendanceRecords.filter(
    (r) => r.date === todayStr && r.present,
  ).length;
  const absentToday = attendanceRecords.filter(
    (r) => r.date === todayStr && !r.present,
  ).length;

  const monthRecs = filteredRecords;
  const totalDaysWorked = monthRecs.filter((r) => r.present).length;
  const totalExtraWork = monthRecs.reduce((s, r) => s + (r.extraWork ?? 0), 0);
  const totalWages = monthRecs.reduce(
    (s, r) => s + (r.present ? r.wage : 0),
    0,
  );
  const totalAdvances = filteredTxns
    .filter((t) => t.type === 'advance')
    .reduce((s, t) => s + t.amount, 0);
  const pendingPayments = salaryRecords
    .filter((s) => s.paymentStatus !== 'paid')
    .reduce((s, r) => s + (r.finalSalary - r.paidAmount), 0);

  const summaryCards = [
    {
      icon: '👷',
      label: 'Total Workers',
      value: String(employees.length),
      color: '#3b82f6',
    },
    {
      icon: '✅',
      label: 'Present Today',
      value: String(presentToday),
      color: '#22c55e',
    },
    {
      icon: '❌',
      label: 'Absent Today',
      value: String(absentToday),
      color: '#ef4444',
    },
    {
      icon: '📅',
      label: 'Days Worked',
      value: String(totalDaysWorked),
      color: '#a78bfa',
    },
    {
      icon: '💰',
      label: 'Wages (Period)',
      value: fmt(totalWages + totalExtraWork),
      color: '#22c55e',
    },
    {
      icon: '💸',
      label: 'Advances (Period)',
      value: fmt(totalAdvances),
      color: '#f59e0b',
    },
    {
      icon: '⭐',
      label: 'Extra Work Pay',
      value: fmt(totalExtraWork),
      color: '#14b8a6',
    },
    {
      icon: '⏳',
      label: 'Pending Payments',
      value: fmt(pendingPayments),
      color: '#ef4444',
    },
  ];

  const empSummary = employees.map((emp, i) => {
    const recs = monthRecs.filter((r) => r.employeeId === emp.id);
    const days = recs.filter((r) => r.present).length;
    const extra = recs.reduce((s, r) => s + (r.extraWork ?? 0), 0);
    const salary = days * emp.dailyWage + extra;
    const advance = filteredTxns
      .filter(
        (t) =>
          t.employeeId === emp.id &&
          t.type === 'advance',
      )
      .reduce((s, t) => s + t.amount, 0);
    const deduction = filteredTxns
      .filter(
        (t) =>
          t.employeeId === emp.id &&
          t.type === 'deduction',
      )
      .reduce((s, t) => s + t.amount, 0);
    const final = salary - advance - deduction;
    return { emp, i, days, salary, advance, deduction, extra, final };
  });

  const attendancePie = [
    { name: 'Present', value: monthRecs.filter((r) => r.present).length },
    { name: 'Absent', value: monthRecs.filter((r) => !r.present).length },
  ].filter((x) => x.value > 0);

  const wagesByWorker = empSummary
    .filter((x) => x.salary > 0)
    .slice(0, 8)
    .map((x) => ({
      name: x.emp.name.split(' ')[0],
      wages: x.salary,
    }));

  const periodLabel =
    dateFilter.mode === 'month'
      ? monthLabel(curMonth())
      : dateFilter.mode === 'year'
        ? String(new Date().getFullYear())
        : dateFilter.mode === 'week'
          ? 'Last 7 days'
          : dateFilter.mode === 'custom'
            ? `${dateFilter.customStart} → ${dateFilter.customEnd}`
            : 'All time';

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {summaryCards.map((c) => (
          <div
            key={c.label}
            className='rounded-xl p-4 flex flex-col gap-1'
            style={{
              background: '#0f172a',
              border: `1px solid ${c.color}22`,
              borderTop: `2px solid ${c.color}`,
            }}
          >
            <div className='flex items-center gap-2'>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span className='text-[10px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-500'>
                {c.label}
              </span>
            </div>
            <div className='text-xl font-bold font-mono text-slate-900 dark:text-slate-100'>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {(attendancePie.length > 0 || wagesByWorker.length > 0) && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
            <div className='mb-3 text-sm font-bold'>💰 Wages &amp; Advances</div>
            <SimpleMoneyFlow
              income={totalWages + totalExtraWork}
              expense={totalAdvances}
              net={totalWages + totalExtraWork - totalAdvances}
            />
          </div>
          {attendancePie.length > 0 && (
            <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
              <div className='mb-3 text-sm font-bold'>✅ Attendance days</div>
              <div className='flex flex-col gap-2'>
                {attendancePie.map((row) => (
                  <div
                    key={row.name}
                    className='flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50'
                  >
                    <span className='text-sm font-semibold'>{row.name}</span>
                    <span className='text-lg font-bold'>{row.value} days</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {wagesByWorker.length > 0 && (
            <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:col-span-2'>
              <div className='mb-3 text-sm font-bold'>👷 Wages by worker</div>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {wagesByWorker.map((x) => (
                  <div
                    key={x.name}
                    className='flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50'
                  >
                    <span className='text-sm font-semibold'>{x.name}</span>
                    <span className='font-bold text-emerald-500'>{fmt(x.wages)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='text-sm font-bold text-slate-900 dark:text-slate-100 mb-4'>
          {periodLabel} — Employee Summary
        </div>
        {empSummary.length === 0 ? (
          <p className='text-xs text-slate-900 dark:text-slate-500 text-center py-6'>
            No workers yet. Add workers in the Employees tab.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-500'>
                  {[
                    'Worker',
                    'Days',
                    'Wage/Day',
                    'Extra',
                    'Total',
                    'Advance',
                    'Deduction',
                    'Final Pay',
                  ].map((h) => (
                    <th
                      key={h}
                      className='px-3 py-2 text-left font-bold uppercase tracking-wider whitespace-nowrap'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empSummary.map(
                  ({
                    emp,
                    i,
                    days,
                    salary,
                    advance,
                    deduction,
                    extra,
                    final,
                  }) => (
                    <tr
                      key={emp.id}
                      className='border-b border-slate-200/70 dark:border-slate-800/50 hover:bg-slate-100/80 dark:bg-slate-800/30'
                    >
                      <td className='px-3 py-2'>
                        <div className='flex items-center gap-2'>
                          <Avatar name={emp.name} index={i} />
                          <span className='font-bold text-slate-900 dark:text-slate-100'>
                            {emp.name}
                          </span>
                        </div>
                      </td>
                      <td className='px-3 py-2 text-emerald-400 font-mono font-bold'>
                        {days}
                      </td>
                      <td className='px-3 py-2 text-slate-500 dark:text-slate-400'>
                        {fmt(emp.dailyWage)}
                      </td>
                      <td className='px-3 py-2 text-teal-400'>
                        {extra > 0 ? fmt(extra) : '—'}
                      </td>
                      <td className='px-3 py-2 text-green-400 font-bold'>
                        {fmt(salary)}
                      </td>
                      <td className='px-3 py-2 text-amber-400'>
                        {advance > 0 ? fmt(advance) : '—'}
                      </td>
                      <td className='px-3 py-2 text-red-400'>
                        {deduction > 0 ? fmt(deduction) : '—'}
                      </td>
                      <td
                        className='px-3 py-2 font-bold font-mono'
                        style={{ color: final >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {fmt(final)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — EMPLOYEES
// ════════════════════════════════════════════════════════════════════════════
function EmployeesTab() {
  const {
    employees,
    attendanceRecords,
    transactions,
    addEmployee,
    updateEmployee,
    deleteEmployee,
  } = useAttendanceStore();
  const cropCycles = useAgriStore((s) => s.cropCycles);
  const accounts = usePortfolioStore((s) => s.accounts);
  useEnsureAgriHydrated();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AttendanceEmployee | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wage, setWage] = useState('300');
  const [notes, setNotes] = useState('');
  const [cropCycleId, setCropCycleId] = useState('');
  const [plantationLabel, setPlantationLabel] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');

  function openAdd(emp?: AttendanceEmployee) {
    setEditing(emp ?? null);
    setName(emp?.name ?? '');
    setPhone(emp?.phone ?? '');
    setWage(String(emp?.dailyWage ?? 300));
    setNotes(emp?.notes ?? '');
    setCropCycleId(emp?.cropCycleId ?? '');
    setPlantationLabel(emp?.plantationLabel ?? '');
    setDefaultAccountId(emp?.defaultAccountId ?? '');
    setOpen(true);
  }

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    const w = parseFloat(wage);
    if (!w || w <= 0) {
      toast.error('Enter a valid daily wage');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        dailyWage: w,
        notes: notes.trim() || undefined,
        cropCycleId: cropCycleId || undefined,
        plantationLabel: plantationLabel.trim() || undefined,
        defaultAccountId: defaultAccountId || undefined,
      };
      if (editing) {
        await updateEmployee(editing.id, payload);
        toast.success('Worker updated');
      } else {
        await addEmployee(payload);
        toast.success('Worker added');
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.phone ?? '').includes(search),
  );

  const month = curMonth();

  function empStats(empId: string) {
    const recs = attendanceRecords.filter(
      (r) => r.employeeId === empId && r.date.startsWith(month),
    );
    const days = recs.filter((r) => r.present).length;
    const earned = recs.reduce(
      (s, r) => s + (r.present ? r.wage + (r.extraWork ?? 0) : 0),
      0,
    );
    const advances = transactions
      .filter((t) => t.employeeId === empId && t.type === 'advance')
      .reduce((s, t) => s + t.amount, 0);
    return { days, earned, advances };
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <input
          className={inp + ' max-w-xs'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search worker name or phone…'
        />
        <button
          onClick={() => openAdd()}
          className='rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700'
        >
          + Add Worker
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className='py-16 text-center text-sm text-slate-900 dark:text-slate-500'>
          No workers yet. Click "Add Worker" to get started.
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {filtered.map((emp, i) => {
            const s = empStats(emp.id);
            return (
              <div
                key={emp.id}
                className='flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'
              >
                <div className='flex items-center gap-3'>
                  <Avatar name={emp.name} index={i} />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-bold text-slate-900 dark:text-slate-100'>
                      {emp.name}
                    </div>
                    <div className='text-xs text-slate-900 dark:text-slate-500'>
                      {fmt(emp.dailyWage)}/day
                      {emp.phone ? ` · ${emp.phone}` : ''}
                    </div>
                    {(emp.plantationLabel || emp.cropCycleId) && (
                      <div className='text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5'>
                        🌾{' '}
                        {emp.plantationLabel ||
                          cropCycles.find((c) => c.id === emp.cropCycleId)
                            ?.cropName ||
                          'Farm'}
                      </div>
                    )}
                  </div>
                </div>

                <div className='grid grid-cols-3 gap-2 text-center'>
                  {[
                    {
                      label: 'Days',
                      val: String(s.days),
                      color: 'text-emerald-400',
                    },
                    {
                      label: 'Earned',
                      val: fmt(s.earned),
                      color: 'text-green-400',
                    },
                    {
                      label: 'Advances',
                      val: fmt(s.advances),
                      color: 'text-amber-400',
                    },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className='rounded-xl bg-slate-200 dark:bg-slate-800 p-2'
                    >
                      <div className='text-[10px] text-slate-900 dark:text-slate-500'>
                        {c.label}
                      </div>
                      <div className={`text-xs font-bold ${c.color}`}>
                        {c.val}
                      </div>
                    </div>
                  ))}
                </div>

                {emp.notes && (
                  <div className='text-xs italic text-slate-900 dark:text-slate-500'>
                    {emp.notes}
                  </div>
                )}

                <div className='flex gap-2'>
                  <button
                    onClick={() => openAdd(emp)}
                    className='flex-1 rounded-lg bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:bg-slate-700'
                  >
                    Edit
                  </button>
                  <ConfirmDelete onDelete={() => deleteEmployee(emp.id)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        title={editing ? 'Edit Worker' : 'Add Worker'}
      >
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <label className={lbl}>Name *</label>
            <input
              className={inp}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. Ravi Kumar'
            />
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input
              className={inp}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='Optional'
            />
          </div>
          <div>
            <label className={lbl}>Daily Wage (₹) *</label>
            <NumericInput className={inp} value={wage} onChange={setWage} />
          </div>
          <div>
            <label className={lbl}>Crop / Plantation</label>
            <select
              className={inp}
              value={cropCycleId}
              onChange={(e) => setCropCycleId(e.target.value)}
            >
              <option value=''>General farm labor</option>
              {cropCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cropName}
                  {c.fieldName ? ` · ${c.fieldName}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Plantation label</label>
            <input
              className={inp}
              value={plantationLabel}
              onChange={(e) => setPlantationLabel(e.target.value)}
              placeholder='e.g. Tomato field, Dairy'
            />
          </div>
          <div>
            <label className={lbl}>Salary account</label>
            <select
              className={inp}
              value={defaultAccountId}
              onChange={(e) => setDefaultAccountId(e.target.value)}
            >
              <option value=''>No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className='sm:col-span-2'>
            <label className={lbl}>Notes</label>
            <input
              className={inp}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Optional'
            />
          </div>
        </div>
        <div className='mt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4'>
          <button
            onClick={() => setOpen(false)}
            disabled={saving}
            className='rounded-xl px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className='rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60'
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — ATTENDANCE
// ════════════════════════════════════════════════════════════════════════════
function AttendanceTab() {
  const {
    employees,
    attendanceRecords,
    transactions,
    updateAttendanceRecord,
    bulkSetAttendance,
    addTransaction,
    deleteTransaction,
  } = useAttendanceStore();

  const [date, setDate] = useState(today());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'present' | 'absent'
  >('all');
  const [quickData, setQuickData] = useState<
    Record<string, { present: boolean; extra: string; note: string }>
  >({});
  const [saving, setSaving] = useState(false);

  // Advance/deduction modal
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnSaving, setTxnSaving] = useState(false);
  const [txnEmp, setTxnEmp] = useState('');
  const [txnType, setTxnType] = useState<TransactionType>('advance');
  const [txnAmt, setTxnAmt] = useState('0');
  const [txnNote, setTxnNote] = useState('');
  const [txnDate, setTxnDate] = useState(today());

  async function handleDeleteTxn(t: {
    id: string;
    employeeId: string;
    date: string;
  }) {
    await deleteTransaction(t.id);
    const { att, agri, port } = getSyncStores();
    await autoSyncSalaryForDate(t.employeeId, t.date, att, agri, port);
    toast.success('Removed — salary auto-updated');
  }

  useEffect(() => {
    const init: Record<
      string,
      { present: boolean; extra: string; note: string }
    > = {};
    employees.forEach((emp) => {
      const rec = attendanceRecords.find(
        (r) => r.employeeId === emp.id && r.date === date,
      );
      init[emp.id] = {
        present: rec?.present ?? false,
        extra: String(rec?.extraWork ?? 0),
        note: rec?.note ?? '',
      };
    });
    setQuickData(init);
  }, [date, employees, attendanceRecords]);

  async function saveAttendance() {
    if (saving) return;
    setSaving(true);
    try {
      const toAdd: Omit<
        AttendanceRecord,
        'id' | 'createdAt' | 'updatedAt' | 'userId'
      >[] = [];
      for (const emp of employees) {
        const d = quickData[emp.id];
        if (!d) continue;
        const existing = attendanceRecords.find(
          (r) => r.employeeId === emp.id && r.date === date,
        );
        const extra = parseFloat(d.extra) || 0;
        const payload = {
          employeeId: emp.id,
          date,
          present: d.present,
          wage: emp.dailyWage,
          extraWork: extra > 0 ? extra : undefined,
          note: d.note || undefined,
        };
        if (existing) {
          await updateAttendanceRecord(existing.id, payload);
        } else {
          toAdd.push(payload);
        }
      }
      if (toAdd.length > 0) await bulkSetAttendance(toAdd);

      const month = date.slice(0, 7);
      for (const emp of employees) {
        const { att, agri, port } = getSyncStores();
        const existing = att.salaryRecords.find(
          (s) => s.employeeId === emp.id && s.month === month,
        );
        if (existing) {
          await autoSyncSalaryForDate(emp.id, date, att, agri, port);
        }
      }

      toast.success(`Attendance saved for ${date} — salary auto-updated`);
    } finally {
      setSaving(false);
    }
  }

  async function saveTxn() {
    if (txnSaving) return;
    const amount = parseFloat(txnAmt);
    if (!txnEmp) {
      toast.error('Select a worker');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('Enter valid amount');
      return;
    }
    setTxnSaving(true);
    try {
      await addTransaction({
        employeeId: txnEmp,
        type: txnType,
        amount,
        note: txnNote.trim() || undefined,
        date: txnDate,
      });
      const { att, agri, port } = getSyncStores();
      await autoSyncSalaryForDate(txnEmp, txnDate, att, agri, port);
      toast.success('Saved — salary auto-updated');
      setTxnOpen(false);
      setTxnAmt('0');
      setTxnNote('');
    } finally {
      setTxnSaving(false);
    }
  }

  const filteredEmps = employees.filter((emp) => {
    if (!emp.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'all') return true;
    const d = quickData[emp.id];
    return statusFilter === 'present' ? d?.present : !d?.present;
  });

  const presentCount = employees.filter((e) => quickData[e.id]?.present).length;
  const todayPay = employees.reduce((s, e) => {
    const d = quickData[e.id];
    return s + (d?.present ? e.dailyWage + (parseFloat(d.extra) || 0) : 0);
  }, 0);

  return (
    <div className='flex flex-col gap-5'>
      {/* Top controls */}
      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <label className={lbl}>Date</label>
          <input
            type='date'
            className={inp}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className='flex-1' style={{ minWidth: 160 }}>
          <label className={lbl}>Search</label>
          <input
            className={inp}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Worker name…'
          />
        </div>
        <div className='flex gap-1'>
          {(['all', 'present', 'absent'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                statusFilter === s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:bg-slate-700'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className='grid grid-cols-3 gap-3'>
        {[
          { label: 'Present', val: presentCount, color: '#22c55e' },
          {
            label: 'Absent',
            val: employees.length - presentCount,
            color: '#ef4444',
          },
          { label: "Today's Pay", val: fmt(todayPay), color: '#3b82f6' },
        ].map((c) => (
          <div
            key={c.label}
            className='rounded-xl p-3 text-center'
            style={{
              background: '#0f172a',
              border: `1px solid ${c.color}22`,
              borderTop: `2px solid ${c.color}`,
            }}
          >
            <div className='text-lg font-bold font-mono text-slate-900 dark:text-slate-100'>
              {c.val}
            </div>
            <div className='text-[10px] text-slate-900 dark:text-slate-500'>
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick mark section */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
            ⚡ Quick Attendance — {date}
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                const u = { ...quickData };
                employees.forEach((e) => {
                  u[e.id] = {
                    ...(u[e.id] ?? { extra: '0', note: '' }),
                    present: true,
                  };
                });
                setQuickData(u);
              }}
              className='rounded-xl bg-emerald-600/20 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-600/30'
            >
              ✅ All Present
            </button>
            <button
              onClick={() => {
                const u = { ...quickData };
                employees.forEach((e) => {
                  u[e.id] = {
                    ...(u[e.id] ?? { extra: '0', note: '' }),
                    present: false,
                  };
                });
                setQuickData(u);
              }}
              className='rounded-xl bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/30'
            >
              ❌ All Absent
            </button>
          </div>
        </div>

        {employees.length === 0 ? (
          <p className='py-8 text-center text-sm text-slate-900 dark:text-slate-500'>
            Add workers first in the Employees tab.
          </p>
        ) : (
          <div className='flex flex-col gap-2'>
            {filteredEmps.map((emp) => {
              const d = quickData[emp.id] ?? {
                present: false,
                extra: '0',
                note: '',
              };
              const dailyTotal = d.present
                ? emp.dailyWage + (parseFloat(d.extra) || 0)
                : 0;
              return (
                <div
                  key={emp.id}
                  className={`rounded-xl border p-3 transition-all ${
                    d.present
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  <div className='flex flex-wrap items-center gap-3'>
                    <button
                      onClick={() =>
                        setQuickData((prev) => ({
                          ...prev,
                          [emp.id]: { ...d, present: !d.present },
                        }))
                      }
                      className={`h-11 w-11 rounded-xl text-xl font-bold transition-all ${
                        d.present
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-500'
                      }`}
                    >
                      {d.present ? '✅' : '❌'}
                    </button>
                    <div className='min-w-0 flex-1'>
                      <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                        {emp.name}
                      </div>
                      <div className='text-xs text-slate-900 dark:text-slate-500'>
                        {fmt(emp.dailyWage)}/day
                        {d.present && (
                          <span className='ml-2 text-emerald-400'>
                            → {fmt(dailyTotal)} today
                          </span>
                        )}
                      </div>
                    </div>
                    {d.present && (
                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-slate-900 dark:text-slate-500'>
                          Extra ₹
                        </span>
                        <input
                          type='number'
                          className='w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100'
                          value={d.extra}
                          onChange={(ev) =>
                            setQuickData((prev) => ({
                              ...prev,
                              [emp.id]: { ...d, extra: ev.target.value },
                            }))
                          }
                          placeholder='0'
                        />
                      </div>
                    )}
                    <input
                      className='w-28 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-500 dark:text-slate-400'
                      value={d.note}
                      onChange={(ev) =>
                        setQuickData((prev) => ({
                          ...prev,
                          [emp.id]: { ...d, note: ev.target.value },
                        }))
                      }
                      placeholder='Note…'
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className='mt-4 flex justify-end'>
          <button
            onClick={saveAttendance}
            disabled={saving}
            className='rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60'
          >
            {saving ? 'Saving…' : '💾 Save Attendance'}
          </button>
        </div>
      </div>

      {/* Advances & Deductions */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
              💸 Advances & Deductions
            </div>
            <div className='text-[10px] text-slate-900 dark:text-slate-500 mt-0.5'>
              Extra work pay → mark in Quick Attendance above
            </div>
          </div>
          <button
            onClick={() => {
              setTxnEmp(employees[0]?.id ?? '');
              setTxnDate(today());
              setTxnAmt('0');
              setTxnNote('');
              setTxnType('advance');
              setTxnOpen(true);
            }}
            className='rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700'
          >
            + Add
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className='py-4 text-center text-xs text-slate-900 dark:text-slate-500'>
            No records yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-500'>
                  {['Date', 'Worker', 'Type', 'Amount', 'Note', ''].map((h) => (
                    <th
                      key={h}
                      className='px-3 py-2 text-left font-bold uppercase tracking-wider'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 60).map((t) => {
                  const emp = employees.find((e) => e.id === t.employeeId);
                  const colors: Record<string, string> = {
                    advance: '#f59e0b',
                    deduction: '#ef4444',
                  };
                  const color = colors[t.type] ?? '#22c55e';
                  return (
                    <tr
                      key={t.id}
                      className='border-b border-slate-200/70 dark:border-slate-800/50 hover:bg-slate-100/80 dark:bg-slate-800/30'
                    >
                      <td className='px-3 py-2 text-slate-500 dark:text-slate-400'>
                        {t.date}
                      </td>
                      <td className='px-3 py-2 font-bold text-slate-900 dark:text-slate-100'>
                        {emp?.name ?? '—'}
                      </td>
                      <td className='px-3 py-2'>
                        <span
                          className='rounded-full px-2 py-0.5 text-[10px] font-bold capitalize'
                          style={{ background: color + '22', color }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td
                        className='px-3 py-2 font-bold font-mono'
                        style={{ color }}
                      >
                        {fmt(t.amount)}
                      </td>
                      <td className='px-3 py-2 text-slate-900 dark:text-slate-500'>
                        {t.note ?? '—'}
                      </td>
                      <td className='px-3 py-2'>
                        <ConfirmDelete
                          onDelete={() => void handleDeleteTxn(t)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction modal */}
      <Modal
        open={txnOpen}
        onClose={() => {
          if (!txnSaving) setTxnOpen(false);
        }}
        title='Add Advance / Deduction'
      >
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <label className={lbl}>Worker *</label>
            <select
              className={inp}
              value={txnEmp}
              onChange={(e) => setTxnEmp(e.target.value)}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Type *</label>
            <div className='flex gap-2'>
              {(['advance', 'deduction'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxnType(t)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold capitalize transition-all ${
                    txnType === t
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {t === 'advance' ? '💸 Advance' : '➖ Deduction'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Amount (₹) *</label>
            <NumericInput className={inp} value={txnAmt} onChange={setTxnAmt} />
          </div>
          <div>
            <label className={lbl}>Date</label>
            <input
              type='date'
              className={inp}
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Note</label>
            <input
              className={inp}
              value={txnNote}
              onChange={(e) => setTxnNote(e.target.value)}
              placeholder='e.g. Festival advance, Rice bag, Tools'
            />
          </div>
        </div>
        <div className='mt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4'>
          <button
            onClick={() => setTxnOpen(false)}
            disabled={txnSaving}
            className='rounded-xl px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={saveTxn}
            disabled={txnSaving}
            className='rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60'
          >
            {txnSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — SALARY
// ════════════════════════════════════════════════════════════════════════════
function SalaryTab() {
  const {
    employees,
    // attendanceRecords,
    // transactions,
    salaryRecords,
    markSalaryPaid,
  } = useAttendanceStore();

  const [month, setMonth] = useState(curMonth());
  const [filterStatus, setFilterStatus] = useState<'all' | PaymentStatus>(
    'all',
  );
  const [searchEmp, setSearchEmp] = useState('');
  const [generating, setGenerating] = useState(false);

  // Pay modal
  const [payOpen, setPayOpen] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [payRecord, setPayRecord] = useState<SalaryRecord | null>(null);
  const [payAmt, setPayAmt] = useState('0');
  const [payStatus, setPayStatus] = useState<PaymentStatus>('paid');

  // function calcSalary(empId: string) {
  //   return calcEmployeeSalary(
  //     empId,
  //     month,
  //     employees,
  //     attendanceRecords,
  //     transactions,
  //   );
  // }

  async function generateAll() {
    if (generating) return;
    setGenerating(true);
    try {
      const { att, agri, port } = getSyncStores();
      await regenerateAllSalariesForMonth(month, att, agri, port);
      toast.success('Salary generated & synced to Agriculture');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePay() {
    if (!payRecord || paySaving) return;
    const amt = parseFloat(payAmt);
    if (isNaN(amt) || amt < 0) {
      toast.error('Enter valid amount');
      return;
    }
    setPaySaving(true);
    try {
      await markSalaryPaid(payRecord.id, amt, payStatus);
      const emp = employees.find((e) => e.id === payRecord.employeeId);
      if (emp) {
        const { port } = getSyncStores();
        const updated = useAttendanceStore
          .getState()
          .salaryRecords.find((s) => s.id === payRecord.id);
        if (updated) {
          await syncSalaryPaymentToCashflow(updated, emp, port);
        }
      }
      toast.success('Payment saved & synced to Cashflow');
      setPayOpen(false);
    } finally {
      setPaySaving(false);
    }
  }

  async function handleDeleteSalary(s: SalaryRecord) {
    // const emp = employees.find((e) => e.id === s.employeeId);
    const { att, agri, port } = getSyncStores();
    await cleanupSalaryLinks(s, att, agri, port);
    toast.success('Salary deleted — Agriculture & Cashflow updated');
  }

  function exportCSV() {
    const rows = salaryRecords
      .filter((s) => s.month === month)
      .map((s) => {
        const emp = employees.find((e) => e.id === s.employeeId);
        return [
          emp?.name ?? s.employeeId,
          s.month,
          s.daysWorked,
          s.baseSalary,
          s.extraWork,
          s.totalSalary,
          s.advance,
          s.deductions,
          s.finalSalary,
          s.paidAmount,
          s.paymentStatus,
        ].join(',');
      });
    const csv =
      'Name,Month,Days,Base,Extra,Total,Advance,Deductions,Final,Paid,Status\n' +
      rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `salary_${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV exported');
  }

  const monthSalaries = salaryRecords.filter((s) => s.month === month);

  const filtered = monthSalaries.filter((s) => {
    const emp = employees.find((e) => e.id === s.employeeId);
    if (searchEmp && !emp?.name.toLowerCase().includes(searchEmp.toLowerCase()))
      return false;
    if (filterStatus !== 'all' && s.paymentStatus !== filterStatus)
      return false;
    return true;
  });

  const totalPayable = monthSalaries.reduce((s, r) => s + r.finalSalary, 0);
  const totalPaid = monthSalaries.reduce((s, r) => s + r.paidAmount, 0);
  const totalPending = totalPayable - totalPaid;

  return (
    <div className='flex flex-col gap-5'>
      <div className='rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300'>
        <strong>Auto-sync enabled:</strong> Generate salary → labor cost appears
        in Agriculture. Mark paid → expense appears in Cashflow. Attendance
        &amp; advance/deduction changes auto-update existing salary records.
      </div>
      {/* Controls */}
      <div className='flex flex-wrap items-end gap-3'>
        <div>
          <label className={lbl}>Month</label>
          <select
            className={inp + ' w-auto'}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months12().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className='flex-1' style={{ minWidth: 160 }}>
          <label className={lbl}>Search</label>
          <input
            className={inp}
            value={searchEmp}
            onChange={(e) => setSearchEmp(e.target.value)}
            placeholder='Worker name…'
          />
        </div>
        <div className='flex gap-1 flex-wrap'>
          {(['all', 'unpaid', 'partially_paid', 'paid'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                filterStatus === s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:bg-slate-700'
              }`}
            >
              {s === 'all'
                ? 'All'
                : s === 'partially_paid'
                  ? 'Partial'
                  : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className='flex gap-2'>
          <button
            onClick={generateAll}
            disabled={generating}
            className='rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60'
          >
            {generating ? '…' : '⚡ Generate All'}
          </button>
          <button
            onClick={exportCSV}
            className='rounded-xl bg-slate-300 dark:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:bg-slate-600'
          >
            📤 CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      {monthSalaries.length > 0 && (
        <div className='grid grid-cols-3 gap-3'>
          {[
            {
              label: 'Total Payable',
              val: fmt(totalPayable),
              color: '#22c55e',
            },
            { label: 'Total Paid', val: fmt(totalPaid), color: '#3b82f6' },
            {
              label: 'Still Pending',
              val: fmt(totalPending),
              color: '#ef4444',
            },
          ].map((c) => (
            <div
              key={c.label}
              className='rounded-xl p-3 text-center'
              style={{
                background: '#0f172a',
                border: `1px solid ${c.color}22`,
                borderTop: `2px solid ${c.color}`,
              }}
            >
              <div className='text-sm font-bold font-mono text-slate-900 dark:text-slate-100'>
                {c.val}
              </div>
              <div className='text-[10px] text-slate-900 dark:text-slate-500'>
                {c.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning: unsaved workers */}
      {employees.filter(
        (emp) => !monthSalaries.find((s) => s.employeeId === emp.id),
      ).length > 0 && (
        <div className='rounded-xl border border-amber-500/20 bg-amber-500/10 p-3'>
          <p className='mb-2 text-xs font-bold text-amber-400'>
            ⚠️ Salary not generated for:{' '}
            {employees
              .filter(
                (emp) => !monthSalaries.find((s) => s.employeeId === emp.id),
              )
              .map((e) => e.name)
              .join(', ')}
          </p>
          <button
            onClick={generateAll}
            disabled={generating}
            className='rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60'
          >
            Generate Now
          </button>
        </div>
      )}

      {/* Salary cards */}
      {filtered.length === 0 ? (
        <p className='py-8 text-center text-sm text-slate-900 dark:text-slate-500'>
          No salary records. Click "Generate All" to create.
        </p>
      ) : (
        <div className='flex flex-col gap-3'>
          {filtered.map((s: any) => {
            const emp = employees.find((e) => e.id === s.employeeId);
            const empIdx = employees.findIndex((e) => e.id === s.employeeId);
            const remaining = s.finalSalary - s.paidAmount;
            return (
              <div
                key={s.id}
                className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'
              >
                {/* Header */}
                <div className='mb-3 flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <Avatar name={emp?.name ?? '?'} index={empIdx} />
                    <div>
                      <div className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                        {emp?.name ?? '—'}
                      </div>
                      <div className='text-xs text-slate-900 dark:text-slate-500'>
                        {s.daysWorked} days worked
                      </div>
                    </div>
                  </div>
                  <div className='flex flex-col items-end gap-1'>
                    <PayBadge status={s.paymentStatus} />
                    {s.agriExpenseId && (
                      <span className='rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400'>
                        🌾 Agri synced
                      </span>
                    )}
                    {s.paidAmount > 0 && (
                      <span className='rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400'>
                        💳 Cashflow
                      </span>
                    )}
                  </div>
                </div>

                {/* Calculation rows */}
                <div className='mb-3 flex flex-col gap-1'>
                  <div className='flex justify-between text-xs'>
                    <span className='text-slate-900 dark:text-slate-500'>
                      Base ({s.daysWorked} × {fmt(emp?.dailyWage ?? 0)})
                    </span>
                    <span className='text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                      {fmt(s.baseSalary)}
                    </span>
                  </div>
                  {s.extraWork > 0 && (
                    <div className='flex justify-between text-xs'>
                      <span className='text-slate-900 dark:text-slate-500'>
                        Extra work
                      </span>
                      <span className='text-teal-400'>+{fmt(s.extraWork)}</span>
                    </div>
                  )}
                  {s.advance > 0 && (
                    <div className='flex justify-between text-xs'>
                      <span className='text-slate-900 dark:text-slate-500'>
                        Advance
                      </span>
                      <span className='text-amber-400'>−{fmt(s.advance)}</span>
                    </div>
                  )}
                  {s.deductions > 0 && (
                    <div className='flex justify-between text-xs'>
                      <span className='text-slate-900 dark:text-slate-500'>
                        Deductions
                      </span>
                      <span className='text-red-400'>−{fmt(s.deductions)}</span>
                    </div>
                  )}
                </div>

                {/* Final pay box */}
                <div className='mb-3 flex items-center justify-between rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-3'>
                  <span className='text-sm font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                    Final Pay
                  </span>
                  <span className='text-xl font-bold font-mono text-emerald-400'>
                    {fmt(s.finalSalary)}
                  </span>
                </div>

                {/* Partial pay breakdown — shown when partially paid */}
                {s.paidAmount > 0 && s.paidAmount < s.finalSalary && (
                  <div className='mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3'>
                    <div className='flex justify-between text-xs mb-1'>
                      <span className='text-amber-400 font-bold'>
                        Already Paid
                      </span>
                      <span className='text-amber-400 font-bold font-mono'>
                        {fmt(s.paidAmount)}
                      </span>
                    </div>
                    <div className='flex justify-between text-xs'>
                      <span className='text-red-400 font-bold'>
                        Still Remaining
                      </span>
                      <span className='text-red-400 font-bold font-mono'>
                        {fmt(remaining)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className='mt-2 h-1.5 w-full rounded-full bg-slate-300 dark:bg-slate-700'>
                      <div
                        className='h-1.5 rounded-full bg-amber-400 transition-all'
                        style={{
                          width: `${Math.min(100, (s.paidAmount / s.finalSalary) * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                    <div className='mt-1 text-right text-[10px] text-slate-900 dark:text-slate-500'>
                      {((s.paidAmount / s.finalSalary) * 100).toFixed(0)}% paid
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className='flex flex-wrap gap-2'>
                  <button
                    onClick={() => {
                      setPayRecord(s);
                      setPayAmt(
                        String(remaining > 0 ? remaining : s.finalSalary),
                      );
                      setPayStatus(
                        s.paymentStatus === 'paid' ? 'unpaid' : 'paid',
                      );
                      setPayOpen(true);
                    }}
                    className='rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-600/30'
                  >
                    💰{' '}
                    {s.paymentStatus === 'paid'
                      ? 'Update Payment'
                      : remaining > 0 && s.paidAmount > 0
                        ? `Pay Remaining ${fmt(remaining)}`
                        : 'Mark Paid'}
                  </button>
                  <button
                    onClick={async () => {
                      const { att, agri, port } = getSyncStores();
                      await regenerateSalaryForEmployee(
                        s.employeeId,
                        month,
                        att,
                        agri,
                        port,
                      );
                      toast.success('Refreshed & synced to Agriculture');
                    }}
                    className='rounded-lg bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:bg-slate-700'
                  >
                    🔄 Refresh
                  </button>
                  <ConfirmDelete onDelete={() => void handleDeleteSalary(s)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pay modal */}
      <Modal
        open={payOpen}
        onClose={() => {
          if (!paySaving) setPayOpen(false);
        }}
        title='Record Payment'
      >
        {payRecord && (
          <div className='flex flex-col gap-4'>
            <div className='rounded-xl bg-slate-200 dark:bg-slate-800 p-3 text-xs'>
              <div className='text-slate-500 dark:text-slate-400'>
                Worker:{' '}
                <strong className='text-slate-900 dark:text-slate-100'>
                  {employees.find((e) => e.id === payRecord.employeeId)?.name}
                </strong>
              </div>
              <div className='mt-1 flex justify-between'>
                <span className='text-slate-500 dark:text-slate-400'>
                  Final Salary
                </span>
                <span className='font-bold text-green-400'>
                  {fmt(payRecord.finalSalary)}
                </span>
              </div>
              {payRecord.paidAmount > 0 && (
                <>
                  <div className='mt-1 flex justify-between'>
                    <span className='text-slate-500 dark:text-slate-400'>
                      Already Paid
                    </span>
                    <span className='font-bold text-amber-400'>
                      {fmt(payRecord.paidAmount)}
                    </span>
                  </div>
                  <div className='mt-1 flex justify-between'>
                    <span className='text-slate-500 dark:text-slate-400'>
                      Remaining
                    </span>
                    <span className='font-bold text-red-400'>
                      {fmt(payRecord.finalSalary - payRecord.paidAmount)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div>
              <label className={lbl}>Paying Now (₹)</label>
              <NumericInput
                className={inp}
                value={payAmt}
                onChange={setPayAmt}
              />
              <div className='mt-1 text-xs text-slate-900 dark:text-slate-500'>
                Enter total cumulative paid amount (including previous payments)
              </div>
            </div>
            <div>
              <label className={lbl}>Payment Status</label>
              <div className='flex gap-2'>
                {(['paid', 'partially_paid', 'unpaid'] as PaymentStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setPayStatus(s)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                        payStatus === s
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {s === 'partially_paid'
                        ? 'Partial'
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className='flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4'>
              <button
                onClick={() => setPayOpen(false)}
                disabled={paySaving}
                className='rounded-xl px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-50'
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={paySaving}
                className='rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60'
              >
                {paySaving ? 'Saving…' : 'Save Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — REPORTS (export / import + productivity table)
// ════════════════════════════════════════════════════════════════════════════
function ReportsTab({ dateFilter }: { dateFilter: DateFilterState }) {
  const {
    employees,
    attendanceRecords,
    transactions,
    salaryRecords,
    exportAttendanceJSON,
    importAttendanceJSON,
  } = useAttendanceStore();
  const importRef = useRef<HTMLInputElement>(null);
  const range = getDateRange(dateFilter);

  function handleExport() {
    const json = exportAttendanceJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('JSON exported');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await importAttendanceJSON(ev.target?.result as string);
        toast.success('Data imported successfully');
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  const productivity = useMemo(() => {
    return employees.map((emp) => {
      const recs = attendanceRecords.filter(
        (r) => r.employeeId === emp.id && isDateInRange(r.date, range),
      );
      const totalDays = recs.length;
      const presentDays = recs.filter((r) => r.present).length;
      const pct = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
      const earned = recs.reduce(
        (s, r) => s + (r.present ? r.wage + (r.extraWork ?? 0) : 0),
        0,
      );
      const advances = transactions
        .filter(
          (t) =>
            t.employeeId === emp.id &&
            t.type === 'advance' &&
            isDateInRange(t.date, range),
        )
        .reduce((s, t) => s + t.amount, 0);
      const deductions = transactions
        .filter(
          (t) =>
            t.employeeId === emp.id &&
            t.type === 'deduction' &&
            isDateInRange(t.date, range),
        )
        .reduce((s, t) => s + t.amount, 0);
      const netPaid = salaryRecords
        .filter((s) => s.employeeId === emp.id)
        .reduce((s, r) => s + r.paidAmount, 0);
      const pending = Math.max(0, earned - advances - deductions - netPaid);
      return {
        emp,
        totalDays,
        presentDays,
        pct,
        earned,
        advances,
        deductions,
        netPaid,
        pending,
      };
    });
  }, [employees, attendanceRecords, transactions, salaryRecords, range]);

  return (
    <div className='flex flex-col gap-5'>
      {/* Export / Import */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='mb-4 text-sm font-bold text-slate-900 dark:text-slate-100'>
          📦 Export & Import Data
        </div>
        <div className='flex flex-wrap gap-3'>
          <button
            onClick={handleExport}
            className='rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700'
          >
            📤 Export JSON Backup
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className='rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700'
          >
            📥 Import JSON
          </button>
          <input
            ref={importRef}
            type='file'
            accept='.json'
            className='hidden'
            onChange={handleImport}
          />
          <div className='self-center text-xs text-slate-900 dark:text-slate-500'>
            Backup includes all workers, attendance, advances & salary records.
          </div>
        </div>
      </div>

      {/* Productivity table */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'>
        <div className='mb-4 text-sm font-bold text-slate-900 dark:text-slate-100'>
          📊 Worker Productivity Report
        </div>
        {productivity.length === 0 ? (
          <p className='py-4 text-center text-xs text-slate-900 dark:text-slate-500'>
            No data yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-500'>
                  {[
                    'Worker',
                    'Present',
                    'Attendance',
                    'Earned',
                    'Advances',
                    'Deductions',
                    'Net Paid',
                    'Pending',
                  ].map((h) => (
                    <th
                      key={h}
                      className='whitespace-nowrap px-3 py-2 text-left font-bold uppercase tracking-wider'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productivity.map(
                  (
                    {
                      emp,
                      presentDays,
                      totalDays,
                      pct,
                      earned,
                      advances,
                      deductions,
                      netPaid,
                      pending,
                    },
                    i,
                  ) => (
                    <tr
                      key={emp.id}
                      className='border-b border-slate-200/70 dark:border-slate-800/50 hover:bg-slate-100/80 dark:bg-slate-800/30'
                    >
                      <td className='px-3 py-2'>
                        <div className='flex items-center gap-2'>
                          <Avatar name={emp.name} index={i} />
                          <span className='font-bold text-slate-900 dark:text-slate-100'>
                            {emp.name}
                          </span>
                        </div>
                      </td>
                      <td className='px-3 py-2 font-mono text-emerald-400'>
                        {presentDays}/{totalDays}
                      </td>
                      <td className='px-3 py-2'>
                        <div className='flex items-center gap-2'>
                          <div className='h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-800'>
                            <div
                              className='h-1.5 rounded-full transition-all'
                              style={{
                                width: `${Math.min(100, pct).toFixed(0)}%`,
                                background:
                                  pct >= 80
                                    ? '#22c55e'
                                    : pct >= 50
                                      ? '#f59e0b'
                                      : '#ef4444',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              color:
                                pct >= 80
                                  ? '#22c55e'
                                  : pct >= 50
                                    ? '#f59e0b'
                                    : '#ef4444',
                            }}
                          >
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className='px-3 py-2 font-bold text-green-400'>
                        {fmt(earned)}
                      </td>
                      <td className='px-3 py-2 text-amber-400'>
                        {advances > 0 ? fmt(advances) : '—'}
                      </td>
                      <td className='px-3 py-2 text-red-400'>
                        {deductions > 0 ? fmt(deductions) : '—'}
                      </td>
                      <td className='px-3 py-2 text-blue-400'>
                        {netPaid > 0 ? fmt(netPaid) : '—'}
                      </td>
                      <td className='px-3 py-2 font-bold'>
                        <span
                          style={{ color: pending > 0 ? '#ef4444' : '#22c55e' }}
                        >
                          {pending > 0 ? fmt(pending) : '✓ Clear'}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
  { id: 'employees', label: 'Workers', emoji: '👷' },
  { id: 'attendance', label: 'Attendance', emoji: '📋' },
  { id: 'salary', label: 'Salary', emoji: '💰' },
  { id: 'reports', label: 'Reports', emoji: '📈' },
];

export function AttendancePage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dateFilter, setDateFilter] = useState<DateFilterState>(() =>
    createDefaultDateFilter('month'),
  );
  const ready = useEnsureAttendanceHydrated();
  useEnsureAgriHydrated();

  if (!ready)
    return (
      <div className='flex h-40 items-center justify-center'>
        <div className='text-sm text-slate-500 dark:text-slate-400'>
          Loading…
        </div>
      </div>
    );

  return (
    <div className='flex flex-col gap-5 pb-12'>
      {/* Header */}
      <header className='rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-indigo-500/5 to-transparent p-5'>
        <div className='flex items-center gap-4'>
          <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl text-white shadow-lg shadow-blue-500/25'>
            👷
          </div>
          <div>
            <h1 className='text-xl font-bold text-slate-900 dark:text-white'>
              Attendance
            </h1>
            <p className='mt-0.5 text-sm text-slate-900 dark:text-slate-500'>
              Farm workers · auto-syncs salary to Agriculture &amp; Cashflow
            </p>
          </div>
        </div>
      </header>

      <DateRangeFilter
        value={dateFilter}
        onChange={setDateFilter}
        accent='blue'
      />

      {/* Tab bar */}
      <div className='flex flex-wrap gap-1 rounded-xl bg-white dark:bg-slate-900 p-1 w-fit'>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              tab === t.id
                ? 'bg-slate-200 dark:bg-slate-800 text-blue-400 shadow-sm'
                : 'text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-700 dark:hover:text-slate-600 dark:text-slate-700 dark:text-slate-300'
            }`}
          >
            <span>{t.emoji}</span>
            <span className='hidden sm:inline'>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab dateFilter={dateFilter} />}
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'salary' && <SalaryTab />}
      {tab === 'reports' && <ReportsTab dateFilter={dateFilter} />}
    </div>
  );
}
