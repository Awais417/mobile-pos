'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { getDashboard, DashboardData } from '@/lib/dashboard';
import { getSales, Sale, PaymentMethod } from '@/lib/sales';
import {
  getExpenses,
  getExpensesSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  Expense,
  ExpensesSummary,
} from '@/lib/expenses';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  blockDecimalKeyDown,
  blockDecimalPaste,
} from '@/lib/whole-number-input';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { SkeletonCard, TableSkeleton } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ActionMenu } from '@/components/ui/ActionMenu';
import {
  inputClass,
  labelClass,
  errorClass,
  secondaryButtonClass,
  dangerButtonClass,
} from '@/components/ui/styles';
import {
  WalletIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ReceiptIcon,
  BoxesIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  PackageIcon,
  SmartphoneIcon,
  TagIcon,
  CreditCardIcon,
  ShoppingCartIcon,
  PlusIcon,
  ClockIcon,
  MinusIcon,
  PencilIcon,
  Trash2Icon,
} from '@/components/icons';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';

const DAY_OPTIONS = [
  { key: 1, label: 'Today' },
  { key: 7, label: '7 Days' },
  { key: 30, label: '30 Days' },
  { key: 90, label: '3 Months' },
  { key: 365, label: '1 Year' },
];

// Same Today/This Week/This Month pattern already used by Sales History's
// own date filter (calendar week starts Sunday, calendar month starts the
// 1st) — reimplemented locally since that page's filter isn't an exported,
// shared component.
type ExpenseDateFilterKey = 'today' | 'week' | 'month' | 'all';

const EXPENSE_HISTORY_FILTERS: { key: ExpenseDateFilterKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

function isInExpenseDateRange(dateStr: string, key: ExpenseDateFilterKey): boolean {
  const date = new Date(dateStr);
  const now = new Date();

  if (key === 'all') return true;

  if (key === 'today') {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  if (key === 'week') {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    return date >= weekStart;
  }

  if (key === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  return true;
}

// yyyy-mm-dd for the native <input type="date"> default value.
function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#10b981',
  CARD: '#3b82f6',
  ONLINE_WALLET: '#a855f7',
  BANK_TRANSFER: '#f59e0b',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  ONLINE_WALLET: 'Online Wallet',
  BANK_TRANSFER: 'Bank Transfer',
};

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function paymentMethodLabel(method: PaymentMethod, sale: Sale): string {
  if (method === 'ONLINE_WALLET') return sale.provider ?? 'Online Wallet';
  if (method === 'BANK_TRANSFER') return sale.bankName ?? 'Bank Transfer';
  return PAYMENT_LABELS[method] ?? method;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

interface QuickAction {
  label: string;
  href: string;
  icon: ComponentType<IconProps>;
  theme: {
    card: string;
    icon: string;
    text: string;
  };
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Open POS',
    href: '/terminal',
    icon: ShoppingCartIcon,
    theme: {
      card: 'border-emerald-100 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-700',
      text: 'text-emerald-900',
    },
  },
  {
    label: 'Add Product',
    href: '/products',
    icon: PlusIcon,
    theme: {
      card: 'border-blue-100 bg-blue-50/70 hover:border-blue-300 hover:bg-blue-50',
      icon: 'bg-blue-100 text-blue-700',
      text: 'text-blue-900',
    },
  },
  {
    label: 'View Inventory',
    href: '/inventory',
    icon: BoxesIcon,
    theme: {
      card: 'border-amber-100 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50',
      icon: 'bg-amber-100 text-amber-700',
      text: 'text-amber-900',
    },
  },
  {
    label: 'View Sales',
    href: '/sales',
    icon: ReceiptIcon,
    theme: {
      card: 'border-indigo-100 bg-indigo-50/70 hover:border-indigo-300 hover:bg-indigo-50',
      icon: 'bg-indigo-100 text-indigo-700',
      text: 'text-indigo-900',
    },
  },
];

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);

  // Subtract Expense — a manually-submitted, database-persisted list of
  // expense entries. Never auto-subtracted: an entry is only added when the
  // admin fills in the form, clicks "Confirm Subtract", and then confirms
  // again in the ConfirmDialog. Daily/Weekly/Monthly Net Sales are computed
  // entirely on the backend (see ExpensesService.getSummary) so the sales
  // period and expense period always match and every refresh/user agrees.
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesSummary, setExpensesSummary] = useState<ExpensesSummary | null>(null);
  const [expensesSummaryLoading, setExpensesSummaryLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<ExpenseDateFilterKey>('today');

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  // Non-null while editing an existing row instead of adding a new one —
  // drives both the modal/dialog wording and whether Confirm calls
  // createExpense or updateExpense.
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseTitleInput, setExpenseTitleInput] = useState('');
  const [expenseDateInput, setExpenseDateInput] = useState('');
  const [expenseNoteInput, setExpenseNoteInput] = useState('');
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [confirmingExpense, setConfirmingExpense] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDashboard(days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    getSales()
      .then((sales) => setRecentSales(sales.slice(0, 5)))
      .catch(() => setRecentSales([]));
  }, []);

  function refreshExpenses() {
    getExpenses()
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setExpensesLoading(false));
  }

  function refreshExpensesSummary() {
    getExpensesSummary()
      .then(setExpensesSummary)
      .catch(() => setExpensesSummary(null))
      .finally(() => setExpensesSummaryLoading(false));
  }

  useEffect(() => {
    refreshExpenses();
    refreshExpensesSummary();
  }, []);

  // No argument = "add" mode (blank form, defaults to today). Passing an
  // existing Expense switches to "edit" mode, pre-filled with its values.
  function openExpenseModal(expense?: Expense) {
    setEditingExpenseId(expense?.id ?? null);
    setExpenseAmountInput(expense ? String(Math.round(Number(expense.amount))) : '');
    setExpenseTitleInput(expense?.title ?? '');
    setExpenseDateInput(expense ? expense.date.slice(0, 10) : todayDateInputValue());
    setExpenseNoteInput(expense?.note ?? '');
    setExpenseError(null);
    setShowExpenseModal(true);
  }

  function closeExpenseModal() {
    setShowExpenseModal(false);
    setEditingExpenseId(null);
    setExpenseAmountInput('');
    setExpenseTitleInput('');
    setExpenseDateInput('');
    setExpenseNoteInput('');
    setExpenseError(null);
  }

  const parsedExpenseAmount =
    expenseAmountInput.trim() === '' ? NaN : Number(expenseAmountInput);
  const isExpenseAmountValid =
    Number.isFinite(parsedExpenseAmount) && parsedExpenseAmount > 0;
  const isExpenseFormValid =
    isExpenseAmountValid && expenseTitleInput.trim() !== '' && expenseDateInput.trim() !== '';

  // "Confirm Subtract" in the form doesn't submit anything by itself — it
  // only opens the ConfirmDialog. The actual POST only happens after that
  // second, explicit confirmation. Also guards against a double-click: once
  // confirmingExpense is true, this early-returns instead of reopening.
  function requestConfirmSubtract() {
    if (confirmingExpense || submittingExpense) return;
    if (!isExpenseAmountValid) {
      setExpenseError('Enter a whole amount greater than 0.');
      return;
    }
    if (expenseTitleInput.trim() === '') {
      setExpenseError('Enter a title or reason for this expense.');
      return;
    }
    if (expenseDateInput.trim() === '') {
      setExpenseError('Select the expense date.');
      return;
    }
    setExpenseError(null);
    setConfirmingExpense(true);
  }

  async function handleConfirmSubtract() {
    if (!isExpenseFormValid || submittingExpense) return;
    setSubmittingExpense(true);
    try {
      const payload = {
        amount: Math.round(parsedExpenseAmount),
        title: expenseTitleInput.trim(),
        date: expenseDateInput,
        note: expenseNoteInput.trim() || undefined,
      };
      if (editingExpenseId) {
        const updated = await updateExpense(editingExpenseId, payload);
        setExpenses((prev) => prev.map((e) => (e.id === editingExpenseId ? updated : e)));
        showToast('success', 'Expense updated.');
      } else {
        const created = await createExpense(payload);
        setExpenses((prev) => [created, ...prev]);
        showToast('success', 'Expense subtracted from Total Sales.');
      }
      setConfirmingExpense(false);
      closeExpenseModal();
      // Today/Weekly/Monthly/Overall totals depend on the backend aggregate,
      // not just this one row, so re-fetch rather than compute locally.
      refreshExpensesSummary();
    } catch {
      setExpenseError('Could not save this expense. Please try again.');
      setConfirmingExpense(false);
    } finally {
      setSubmittingExpense(false);
    }
  }

  function requestDeleteExpense(expense: Expense) {
    if (deletingExpense) return;
    setDeleteExpenseTarget(expense);
  }

  async function handleConfirmDeleteExpense() {
    if (!deleteExpenseTarget || deletingExpense) return;
    setDeletingExpense(true);
    try {
      await deleteExpense(deleteExpenseTarget.id);
      setExpenses((prev) => prev.filter((e) => e.id !== deleteExpenseTarget.id));
      setDeleteExpenseTarget(null);
      showToast('success', 'Expense deleted.');
      refreshExpensesSummary();
    } catch {
      showToast('error', 'Could not delete this expense.');
    } finally {
      setDeletingExpense(false);
    }
  }

  const filteredExpenseHistory = expenses.filter((e) => isInExpenseDateRange(e.date, historyFilter));

  const kpis = data?.kpis;
  const changePct = kpis ? parseFloat(kpis.revenueChangePct) : 0;
  const isUp = changePct >= 0;
  const periodProfitNum = kpis ? Number(kpis.periodProfit) : 0;
  const isLoss = periodProfitNum < 0;

  const selectedLabel =
    DAY_OPTIONS.find((o) => o.key === days)?.label ?? 'Selected Period';

  const kpiCards: {
    label: string;
    value: string | number;
    icon: ComponentType<IconProps>;
    color: string;
    trend?: { label: string; positive?: boolean };
  }[] = kpis
    ? [
        {
          label: `Sales (${selectedLabel})`,
          value: formatCurrency(kpis.periodRevenue),
          icon: WalletIcon,
          color: 'bg-emerald-50 text-emerald-600',
          trend: {
            label: `${Math.abs(changePct).toFixed(1)}% vs previous period`,
            positive: isUp,
          },
        },
        {
          label: isLoss ? 'Loss' : 'Total Profit',
          value: formatCurrency(Math.abs(periodProfitNum)),
          icon: isLoss ? TrendingDownIcon : TrendingUpIcon,
          color: isLoss ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
        },
        {
          label: 'Total Cost',
          value: formatCurrency(kpis.periodCost),
          icon: CreditCardIcon,
          color: 'bg-orange-50 text-orange-600',
        },
        {
          label: 'Available Inventory',
          value: formatNumber(kpis.availableDevices),
          icon: SmartphoneIcon,
          color: 'bg-emerald-50 text-emerald-600',
        },
        {
          label: 'Sold Devices',
          value: formatNumber(kpis.soldDevices),
          icon: CheckCircleIcon,
          color: 'bg-blue-50 text-blue-600',
        },
        {
          label: 'Low Stock',
          value: formatNumber(kpis.lowStockCount),
          icon: AlertTriangleIcon,
          color: 'bg-amber-50 text-amber-600',
        },
        {
          label: 'Total Products',
          value: formatNumber(kpis.totalProducts),
          icon: PackageIcon,
          color: 'bg-indigo-50 text-indigo-600',
        },
        {
          label: 'Total Inventory',
          value: formatNumber(kpis.totalInventory),
          icon: BoxesIcon,
          color: 'bg-slate-100 text-slate-600',
        },
        {
          label: 'Avg Sale Value',
          value: formatCurrency(kpis.avgSaleValue),
          icon: WalletIcon,
          color: 'bg-purple-50 text-purple-600',
        },
        {
          label: 'Number of Sales',
          value: formatNumber(kpis.periodSales),
          icon: ReceiptIcon,
          color: 'bg-purple-50 text-purple-600',
        },
        {
          label: 'Inventory Value',
          value: formatCurrency(kpis.inventoryValue),
          icon: TagIcon,
          color: 'bg-slate-100 text-slate-600',
        },
      ]
    : [];

  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title={`${greeting()}, ${firstName}`}
          subtitle="Here's your mobile shop's performance overview."
          actions={
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setDays(opt.key)}
                  className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    days === opt.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        />

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className={`flex h-28 flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${a.theme.card}`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${a.theme.icon}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`text-sm font-semibold ${a.theme.text}`}>{a.label}</span>
              </Link>
            );
          })}
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} className="h-32" />)
            : kpiCards.map((c) => <SummaryCard key={c.label} {...c} />)}
        </div>

        {/* Net Sales = Total Sales - Total Expenses, computed separately for
            each period (Today/Weekly/Monthly/Overall) by the backend so the
            sales side and the expense side always cover the exact same
            window — Total Sales itself is never modified, only read. Expense
            entries are only created/changed when the admin explicitly
            submits and confirms the "Subtract Expense" form — nothing here
            is automatic. */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Net Sales</h2>
            <button type="button" onClick={() => openExpenseModal()} className={dangerButtonClass}>
              <MinusIcon className="h-4 w-4" />
              Subtract Expense
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: 'today', label: 'Today' },
                { key: 'weekly', label: 'Weekly' },
                { key: 'monthly', label: 'Monthly' },
                { key: 'overall', label: 'Overall' },
              ] as const
            ).map(({ key, label }) => {
              const period = expensesSummary?.[key];
              const net = period ? Number(period.net) : 0;
              const ready = !expensesSummaryLoading && period;
              return (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-700">{label}</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Sales</span>
                      <span className="font-medium text-slate-900">
                        {ready ? formatCurrency(period.sales) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total Expenses</span>
                      <span className="font-medium text-red-600">
                        {ready ? formatCurrency(period.expenses) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5">
                      <span className="font-medium text-slate-700">Net Sales</span>
                      <span
                        className={`font-bold ${net < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {ready ? formatCurrency(period.net) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense History — every saved expense (title/reason, optional
            note, amount, date, who added it, when), filterable by the same
            Today/This Week/This Month pattern used on the Sales History
            page. Deleting here only removes the Expense row itself — it
            never touches Sale records or Total Sales. */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Expense History</h2>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_HISTORY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setHistoryFilter(f.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    historyFilter === f.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {expensesLoading ? (
            <TableSkeleton />
          ) : filteredExpenseHistory.length === 0 ? (
            <EmptyState
              icon={ReceiptIcon}
              title="No expenses recorded"
              description="Subtracted expenses will appear here."
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Title / Reason</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Created By</th>
                    <th className="px-4 py-3 font-medium">Created Time</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenseHistory.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-500">{fmtDate(e.date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{e.title}</td>
                      <td className="px-4 py-3 max-w-50 truncate text-slate-500" title={e.note ?? undefined}>
                        {e.note ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={e.amount} tone="danger" size="sm" />
                      </td>
                      {/* This shop has no branches/outlets configured yet
                          (no Outlet rows, no branch switcher anywhere in the
                          app), so every expense and every sale is already
                          "all branches" — shown here for consistency with
                          that same consolidated view. */}
                      <td className="px-4 py-3 text-slate-500">All Branches</td>
                      <td className="px-4 py-3 text-slate-500">{e.createdByName}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {fmtDate(e.createdAt)} · {fmtTime(e.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          actions={[
                            {
                              label: 'Edit',
                              icon: PencilIcon,
                              variant: 'edit',
                              onClick: () => openExpenseModal(e),
                            },
                            {
                              label: 'Delete',
                              icon: Trash2Icon,
                              variant: 'delete',
                              onClick: () => requestDeleteExpense(e),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Revenue Trend Chart */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Sales &amp; Profit Overview</h2>
          {loading ? (
            <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
          ) : data && data.revenueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                  tickFormatter={(v) => formatNumber(v as number)}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip
                  labelFormatter={(v) => fmtDate(v as string)}
                  formatter={(value, name) => {
                    const num = Number(value);
                    if (name === 'Profit' && num < 0) {
                      return [`${formatCurrency(Math.abs(num))} (Loss)`, 'Profit/Loss'];
                    }
                    return [formatCurrency(value as number), name];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Sales"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-slate-400">
              No sales data in this range
            </div>
          )}
        </div>

        {/* Inventory Overview — only real statuses (no Returned/Repair, not
            part of the UnitStatus enum) */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Inventory Overview</h2>
          {loading ? (
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="text-xs font-medium text-slate-500">Total Inventory</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {formatNumber(kpis?.totalInventory)}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="text-xs font-medium text-emerald-700">Available</div>
                <div className="mt-1 text-xl font-bold text-emerald-800">
                  {formatNumber(kpis?.availableDevices)}
                </div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="text-xs font-medium text-blue-700">Sold</div>
                <div className="mt-1 text-xl font-bold text-blue-800">
                  {formatNumber(kpis?.soldDevices)}
                </div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="text-xs font-medium text-amber-700">Low Stock</div>
                <div className="mt-1 text-xl font-bold text-amber-800">
                  {formatNumber(kpis?.lowStockCount)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Payment Distribution */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Payment Method Distribution
            </h2>
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : data && data.paymentDistribution.some((p) => p.count > 0) ? (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.paymentDistribution.filter((p) => p.count > 0)}
                      dataKey="amount"
                      nameKey="method"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {data.paymentDistribution
                        .filter((p) => p.count > 0)
                        .map((entry) => (
                          <Cell
                            key={entry.method}
                            fill={PAYMENT_COLORS[entry.method] ?? '#94a3b8'}
                          />
                        ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 sm:w-auto">
                  {data.paymentDistribution
                    .filter((p) => p.count > 0)
                    .map((p) => (
                      <div key={p.method} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: PAYMENT_COLORS[p.method] ?? '#94a3b8',
                          }}
                        />
                        <span className="w-28 text-slate-600">
                          {PAYMENT_LABELS[p.method] ?? p.method}
                        </span>
                        <span className="font-semibold text-slate-900">
                          {p.percentage}%
                        </span>
                        <span className="text-slate-400">
                          {formatCurrency(p.amount)} · {formatNumber(p.count)} txn
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                No payment data in this range
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Low Stock Alerts</h2>
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : data && data.lowStockProducts.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {data.lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    <span className="text-xs font-semibold text-amber-700">
                      {formatNumber(p.stockQty)} left (alert at {formatNumber(p.reorderLevel)})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-slate-400">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                  <CheckCircleIcon className="h-6 w-6" />
                </span>
                All products well stocked
              </div>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Sales</h2>
            <Link href="/sales" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <EmptyState
              icon={ClockIcon}
              title="No sales recorded"
              description="Completed sales will appear here."
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-150 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Payment Method</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                        #{s.dailyInvoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {s.items.length} item{s.items.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{paymentMethodLabel(s.paymentMethod, s)}</td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={s.totalAmount} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="success">Paid</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmtTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showExpenseModal && (
        <Modal
          title={editingExpenseId ? 'Edit Expense' : 'Subtract Expense'}
          onClose={closeExpenseModal}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="expense-title">
                Expense Title / Reason
              </label>
              <input
                id="expense-title"
                type="text"
                autoFocus
                value={expenseTitleInput}
                onChange={(e) => {
                  setExpenseTitleInput(e.target.value);
                  setExpenseError(null);
                }}
                placeholder="e.g. Shop Rent"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="expense-amount">
                Expense Amount
              </label>
              <input
                id="expense-amount"
                type="text"
                inputMode="numeric"
                value={expenseAmountInput}
                onChange={(e) => {
                  setExpenseAmountInput(e.target.value.replace(/[^0-9]/g, ''));
                  setExpenseError(null);
                }}
                onKeyDown={blockDecimalKeyDown}
                onPaste={blockDecimalPaste}
                placeholder="e.g. 50000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="expense-date">
                Expense Date
              </label>
              <input
                id="expense-date"
                type="date"
                value={expenseDateInput}
                onChange={(e) => {
                  setExpenseDateInput(e.target.value);
                  setExpenseError(null);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="expense-note">
                Note <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="expense-note"
                value={expenseNoteInput}
                onChange={(e) => setExpenseNoteInput(e.target.value)}
                rows={2}
                placeholder="e.g. Paid via bank transfer"
                className={inputClass}
              />
            </div>
            {expenseError && <p className={errorClass}>{expenseError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeExpenseModal} className={`flex-1 ${secondaryButtonClass}`}>
                Cancel
              </button>
              <button
                type="button"
                onClick={requestConfirmSubtract}
                disabled={!isExpenseFormValid || confirmingExpense}
                className={`flex-1 ${dangerButtonClass}`}
              >
                {editingExpenseId ? 'Save Changes' : 'Confirm Subtract'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmingExpense && (
        <ConfirmDialog
          title={editingExpenseId ? 'Save These Changes?' : 'Subtract This Expense?'}
          description={
            editingExpenseId
              ? `"${expenseTitleInput.trim()}" will be updated to ${formatCurrency(Math.round(parsedExpenseAmount))} on ${expenseDateInput}. Today/Weekly/Monthly/Overall Net Sales will update immediately.`
              : `"${expenseTitleInput.trim()}" — ${formatCurrency(Math.round(parsedExpenseAmount))} on ${expenseDateInput} — will be subtracted from Total Sales. Today/Weekly/Monthly/Overall Net Sales will update immediately.`
          }
          confirmLabel={
            submittingExpense
              ? editingExpenseId
                ? 'Saving...'
                : 'Subtracting...'
              : editingExpenseId
                ? 'Save Changes'
                : 'Subtract Expense'
          }
          variant="danger"
          loading={submittingExpense}
          onConfirm={handleConfirmSubtract}
          onCancel={() => setConfirmingExpense(false)}
        />
      )}

      {deleteExpenseTarget && (
        <ConfirmDialog
          title="Delete This Expense?"
          description={`"${deleteExpenseTarget.title}" (${formatCurrency(deleteExpenseTarget.amount)}) will be permanently deleted. This never affects Sale records — only Expense History and Net Sales.`}
          confirmLabel={deletingExpense ? 'Deleting...' : 'Delete Expense'}
          variant="danger"
          loading={deletingExpense}
          onConfirm={handleConfirmDeleteExpense}
          onCancel={() => setDeleteExpenseTarget(null)}
        />
      )}
    </div>
  );
}
