import type {
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceTransaction,
  CashflowEntry,
  PaymentStatus,
  SalaryRecord,
} from '../types/investmentTypes';
import { removeAgriCashflow, syncAgriCashflow } from './agriCashflowSync';

export type SalaryCalc = {
  emp: AttendanceEmployee;
  daysWorked: number;
  baseSalary: number;
  extraWork: number;
  totalSalary: number;
  advance: number;
  deductions: number;
  finalSalary: number;
};

type AttSlice = {
  employees: AttendanceEmployee[];
  attendanceRecords: AttendanceRecord[];
  transactions: AttendanceTransaction[];
  salaryRecords: SalaryRecord[];
  addSalaryRecord: (
    s: Omit<SalaryRecord, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  ) => Promise<string | void>;
  updateSalaryRecord: (
    id: string,
    patch: Partial<SalaryRecord>,
  ) => Promise<void>;
  deleteSalaryRecord: (id: string) => Promise<void>;
};

type AgriSlice = {
  cropCycles: { id: string; cropName: string }[];
  addAgriExpense: (e: {
    cropCycleId?: string;
    cropName?: string;
    plantationLabel?: string;
    category: 'labor';
    amount: number;
    date: string;
    notes?: string;
    accountId?: string;
  }) => Promise<string | void>;
  updateAgriExpense: (id: string, patch: Record<string, unknown>) => Promise<void>;
  deleteAgriExpense: (id: string) => Promise<void>;
};

type PortSlice = {
  cashflows: CashflowEntry[];
  addCashflow: (
    entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>;
  deleteCashflow: (id: string) => Promise<void>;
};

/** Shared salary formula used across attendance UI and auto-sync. */
export function calcEmployeeSalary(
  empId: string,
  month: string,
  employees: AttendanceEmployee[],
  attendanceRecords: AttendanceRecord[],
  transactions: AttendanceTransaction[],
): SalaryCalc | null {
  const emp = employees.find((e) => e.id === empId);
  if (!emp) return null;

  const recs = attendanceRecords.filter(
    (r) => r.employeeId === empId && r.date.startsWith(month),
  );
  const daysWorked = recs.filter((r) => r.present).length;
  const baseSalary = daysWorked * emp.dailyWage;
  const extraWork = recs.reduce((s, r) => s + (r.extraWork ?? 0), 0);
  const totalSalary = baseSalary + extraWork;
  const advance = transactions
    .filter(
      (t) =>
        t.employeeId === empId &&
        t.type === 'advance' &&
        t.date.startsWith(month),
    )
    .reduce((s, t) => s + t.amount, 0);
  const deductions = transactions
    .filter(
      (t) =>
        t.employeeId === empId &&
        t.type === 'deduction' &&
        t.date.startsWith(month),
    )
    .reduce((s, t) => s + t.amount, 0);
  const finalSalary = totalSalary - advance - deductions;

  return {
    emp,
    daysWorked,
    baseSalary,
    extraWork,
    totalSalary,
    advance,
    deductions,
    finalSalary,
  };
}

function monthEndDate(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).toISOString().split('T')[0];
}

function plantationName(emp: AttendanceEmployee, agri: AgriSlice) {
  if (emp.plantationLabel) return emp.plantationLabel;
  if (emp.cropCycleId) {
    const crop = agri.cropCycles.find((c) => c.id === emp.cropCycleId);
    if (crop) return crop.cropName;
  }
  return 'Farm Labor';
}

/** Mirror salary as a labor expense in Agriculture (farm P&L). */
export async function syncSalaryToAgri(
  salary: SalaryRecord,
  emp: AttendanceEmployee,
  att: AttSlice,
  agri: AgriSlice,
): Promise<SalaryRecord> {
  const plantation = plantationName(emp, agri);
  const expenseDate = monthEndDate(salary.month);
  const notes = `Auto: ${emp.name} salary — ${salary.month} (${salary.daysWorked} days)`;

  if (salary.finalSalary <= 0) {
    if (salary.agriExpenseId) {
      await agri.deleteAgriExpense(salary.agriExpenseId);
      await att.updateSalaryRecord(salary.id, { agriExpenseId: undefined });
    }
    return { ...salary, agriExpenseId: undefined };
  }

  const expensePayload = {
    cropCycleId: emp.cropCycleId,
    cropName: plantation,
    plantationLabel: plantation,
    category: 'labor' as const,
    amount: salary.finalSalary,
    date: expenseDate,
    notes,
    accountId: salary.accountId ?? emp.defaultAccountId,
  };

  if (salary.agriExpenseId) {
    await agri.updateAgriExpense(salary.agriExpenseId, expensePayload);
    return salary;
  }

  const newId = await agri.addAgriExpense(expensePayload);
  if (typeof newId === 'string') {
    await att.updateSalaryRecord(salary.id, { agriExpenseId: newId });
    return { ...salary, agriExpenseId: newId };
  }
  return salary;
}

/** Sync actual salary payment to personal Cashflow. */
export async function syncSalaryPaymentToCashflow(
  salary: SalaryRecord,
  emp: AttendanceEmployee,
  port: PortSlice,
) {
  const payDate = monthEndDate(salary.month);
  const accountId = salary.accountId ?? emp.defaultAccountId;
  const plantation = emp.plantationLabel ?? 'Farm';
  const notes = `Salary: ${emp.name} — ${salary.month} (${plantation})`;

  await syncAgriCashflow(
    port.cashflows,
    port.addCashflow,
    port.updateCashflow,
    port.deleteCashflow,
    'expense',
    'salary',
    salary.id,
    'Farm Labor',
    salary.paidAmount,
    payDate,
    accountId,
    notes,
  );
}

/** Upsert monthly salary for one worker and sync labor cost to Agriculture. */
export async function regenerateSalaryForEmployee(
  employeeId: string,
  month: string,
  att: AttSlice,
  agri: AgriSlice,
  port: PortSlice,
) {
  const data = calcEmployeeSalary(
    employeeId,
    month,
    att.employees,
    att.attendanceRecords,
    att.transactions,
  );
  if (!data) return null;

  const existing = att.salaryRecords.find(
    (s) => s.employeeId === employeeId && s.month === month,
  );

  const payload = {
    employeeId,
    month,
    daysWorked: data.daysWorked,
    baseSalary: data.baseSalary,
    extraWork: data.extraWork,
    totalSalary: data.totalSalary,
    advance: data.advance,
    deductions: data.deductions,
    finalSalary: data.finalSalary,
    paidAmount: existing?.paidAmount ?? 0,
    paymentStatus: existing?.paymentStatus ?? ('unpaid' as PaymentStatus),
    accountId: existing?.accountId ?? data.emp.defaultAccountId,
    agriExpenseId: existing?.agriExpenseId,
  };

  let salaryId = existing?.id;
  if (existing) {
    await att.updateSalaryRecord(existing.id, payload);
  } else {
    salaryId = (await att.addSalaryRecord(payload)) ?? undefined;
  }

  if (!salaryId) return null;

  let salary: SalaryRecord = {
    ...(existing ?? { id: salaryId, userId: '', createdAt: '', updatedAt: '' }),
    ...payload,
    id: salaryId,
  };

  salary = await syncSalaryToAgri(salary, data.emp, att, agri);

  if (salary.paidAmount > 0) {
    await syncSalaryPaymentToCashflow(salary, data.emp, port);
  }

  return salary;
}

/** Regenerate all worker salaries for a month + sync to Agriculture. */
export async function regenerateAllSalariesForMonth(
  month: string,
  att: AttSlice,
  agri: AgriSlice,
  port: PortSlice,
) {
  for (const emp of att.employees) {
    await regenerateSalaryForEmployee(emp.id, month, att, agri, port);
  }
}

/** Remove agriculture + cashflow links when a salary record is deleted. */
export async function cleanupSalaryLinks(
  salary: SalaryRecord,
  att: AttSlice,
  agri: AgriSlice,
  port: PortSlice,
) {
  if (salary.agriExpenseId) {
    await agri.deleteAgriExpense(salary.agriExpenseId);
  }
  await removeAgriCashflow(
    port.cashflows,
    port.deleteCashflow,
    'expense',
    'salary',
    salary.id,
  );
  await att.deleteSalaryRecord(salary.id);
}

/** After attendance/transaction change — auto-refresh salary if record exists. */
export async function autoSyncSalaryForDate(
  employeeId: string,
  date: string,
  att: AttSlice,
  agri: AgriSlice,
  port: PortSlice,
) {
  const month = date.slice(0, 7);
  const existing = att.salaryRecords.find(
    (s) => s.employeeId === employeeId && s.month === month,
  );
  if (!existing) return;
  await regenerateSalaryForEmployee(employeeId, month, att, agri, port);
}
