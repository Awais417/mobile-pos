'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSales, archiveSale, voidSale, Sale, PaymentMethod } from '@/lib/sales';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, SkeletonCard } from '@/components/ui/Skeletons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Drawer } from '@/components/ui/Drawer';
import { inputClass, labelClass } from '@/components/ui/styles';
import {
  WalletIcon,
  ReceiptIcon,
  CheckCircleIcon,
  CreditCardIcon,
  SmartphoneIcon,
  LandmarkIcon,
  InboxIcon,
  AlertTriangleIcon,
  EyeIcon,
  Trash2Icon,
  XIcon,
} from '@/components/icons';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';

type DateFilterKey = 'today' | 'week' | 'month' | 'specific' | 'all';
type PaymentFilterKey = PaymentMethod | 'ALL';

const DATE_FILTERS: { key: DateFilterKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'specific', label: 'Specific Date' },
  { key: 'all', label: 'All Time' },
];

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PAYMENT_FILTERS: {
  key: PaymentFilterKey;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { key: 'ALL', label: 'All Methods', icon: WalletIcon },
  { key: 'CASH', label: 'Cash', icon: WalletIcon },
  { key: 'CARD', label: 'Card', icon: CreditCardIcon },
  { key: 'ONLINE_WALLET', label: 'Wallet', icon: SmartphoneIcon },
  { key: 'BANK_TRANSFER', label: 'Bank', icon: LandmarkIcon },
];

function isInRange(dateStr: string, key: DateFilterKey, specificDate: string): boolean {
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

  if (key === 'specific') {
    if (!specificDate) return false;
    // Parsed as local Y/M/D (not `new Date(specificDate)`, which JS treats as
    // UTC midnight for a date-only string and can land on the wrong local day)
    // then compared against the sale's own local Y/M/D — the full local day,
    // 12:00 AM to 11:59:59 PM, regardless of what timezone createdAt is stored in.
    const [y, m, d] = specificDate.split('-').map(Number);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  return true;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function paymentLabel(sale: Sale): { text: string; icon: ComponentType<IconProps> } {
  switch (sale.paymentMethod) {
    case 'CASH':
      return { text: 'Cash', icon: WalletIcon };
    case 'CARD':
      return { text: 'Card', icon: CreditCardIcon };
    case 'ONLINE_WALLET':
      return { text: sale.provider ?? 'Wallet', icon: SmartphoneIcon };
    case 'BANK_TRANSFER':
      return { text: sale.bankName ?? 'Bank Transfer', icon: LandmarkIcon };
    default:
      return { text: sale.paymentMethod, icon: WalletIcon };
  }
}

// First sold item's name, plus a "+X more" suffix when the sale has
// additional items — from the sale's own items, never recomputed elsewhere.
function productSummary(sale: Sale): string {
  if (sale.items.length === 0) return '—';
  const extra = sale.items.length - 1;
  return extra > 0 ? `${sale.items[0].productName} +${extra} more` : sale.items[0].productName;
}

// costPrice sale ke waqt snapshot ki gayi hai — backend-authoritative values
// ka sirf sum hai, koi naya calculation nahi
function saleProfit(sale: Sale): number {
  return sale.items.reduce(
    (sum, item) => sum + (Number(item.lineTotal) - Number(item.costPrice) * item.quantity),
    0,
  );
}

export default function SalesHistoryPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Sale | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('today');
  const [specificDate, setSpecificDate] = useState(todayIsoDate());
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterKey>('ALL');
  const [salesmanFilter, setSalesmanFilter] = useState('');

  useEffect(() => {
    getSales()
      .then(setSales)
      .catch(() => setError('Could not load sales.'))
      .finally(() => setLoading(false));
  }, []);

  const salesmen = useMemo(() => Array.from(new Set(sales.map((s) => s.cashierName))), [sales]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (!isInRange(s.createdAt, dateFilter, specificDate)) return false;
      if (paymentFilter !== 'ALL' && s.paymentMethod !== paymentFilter) return false;
      if (salesmanFilter && s.cashierName !== salesmanFilter) return false;
      if (q) {
        const hay = [String(s.dailyInvoiceNumber), s.cashierName, ...s.items.map((i) => i.productName)]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sales, search, dateFilter, specificDate, paymentFilter, salesmanFilter]);

  const summary = useMemo(() => {
    return filteredSales.reduce(
      (acc, s) => {
        acc.total += parseFloat(s.totalAmount);
        acc.profit += saleProfit(s);
        acc.count += 1;
        return acc;
      },
      { total: 0, profit: 0, count: 0 },
    );
  }, [filteredSales]);

  const hasActiveFilters = !!(salesmanFilter || paymentFilter !== 'ALL');

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveSale(archiveTarget.id, archiveReason.trim() || undefined);
      setSales((prev) => prev.filter((s) => s.id !== archiveTarget.id));
      showToast('success', 'Sale deleted. Revenue and profit are unaffected.');
      setArchiveTarget(null);
      setArchiveReason('');
    } catch {
      showToast('error', 'Could not delete this sale.');
    } finally {
      setArchiving(false);
    }
  }

  // Cancels the sale entirely — reverses inventory and (for a client sale)
  // its balance. Unlike Delete/Archive above, the row stays in this list,
  // just marked Voided; nothing is hidden or removed.
  async function handleVoid() {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const voided = await voidSale(voidTarget.id, voidReason.trim() || undefined);
      setSales((prev) => prev.map((s) => (s.id === voided.id ? { ...s, voidedAt: voided.voidedAt } : s)));
      showToast('success', 'Sale voided — inventory has been restored.');
      setVoidTarget(null);
      setVoidReason('');
    } catch {
      showToast('error', 'Could not void this sale.');
    } finally {
      setVoiding(false);
    }
  }

  const summaryCards = [
    { label: 'Total Amount', value: formatCurrency(summary.total), icon: WalletIcon, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Number of Sales', value: formatNumber(summary.count), icon: ReceiptIcon, color: 'bg-blue-50 text-blue-600' },
    ...(isAdmin
      ? [{ label: 'Total Profit', value: formatCurrency(summary.profit), icon: CheckCircleIcon, color: 'bg-purple-50 text-purple-600' }]
      : []),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Sales History" subtitle="View and track all completed transactions" />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                dateFilter === f.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          {dateFilter === 'specific' && (
            <>
              <input
                type="date"
                value={specificDate}
                max={todayIsoDate()}
                onChange={(e) => setSpecificDate(e.target.value)}
                className={`${inputClass} w-auto`}
                aria-label="Select a date"
              />
              <button
                type="button"
                onClick={() => {
                  setDateFilter('today');
                  setSpecificDate(todayIsoDate());
                }}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 underline-offset-2 transition hover:text-primary hover:underline"
              >
                Reset to Today
              </button>
            </>
          )}
        </div>

        <div className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice #, salesman or item..." />
        </div>

        <FilterToolbar
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setPaymentFilter('ALL');
            setSalesmanFilter('');
          }}
        >
          {PAYMENT_FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setPaymentFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  paymentFilter === f.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
          {isAdmin && salesmen.length > 1 && (
            <select
              value={salesmanFilter}
              onChange={(e) => setSalesmanFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
            >
              <option value="">All Salesmen</option>
              {salesmen.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </FilterToolbar>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)
            : summaryCards.map((c) => <SummaryCard key={c.label} {...c} />)}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : filteredSales.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title={dateFilter === 'specific' ? 'No sales found for this date' : 'No sales recorded'}
              description={
                dateFilter === 'specific'
                  ? 'Try selecting a different date, or reset to today.'
                  : 'Completed sales will appear here.'
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Date &amp; Time</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Payment Method</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    {isAdmin && <th className="px-4 py-3 font-medium">Profit</th>}
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const pay = paymentLabel(sale);
                    return (
                      <tr key={sale.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">
                          #{sale.dailyInvoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDate(sale.createdAt)} · {formatTime(sale.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className="block max-w-50 truncate" title={sale.items.map((i) => i.productName).join(', ')}>
                            {productSummary(sale)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <pay.icon className="h-3.5 w-3.5 text-slate-400" />
                            {pay.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <PriceDisplay value={sale.totalAmount} />
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <PriceDisplay value={saleProfit(sale)} tone={saleProfit(sale) < 0 ? 'danger' : 'success'} />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {sale.voidedAt ? (
                            <StatusBadge tone="neutral">Voided</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">Paid</StatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ActionMenu
                            actions={[
                              { label: 'View', icon: EyeIcon, variant: 'view', onClick: () => setViewSale(sale) },
                              ...(isAdmin && !sale.voidedAt
                                ? [{ label: 'Void', icon: XIcon, variant: 'delete' as const, onClick: () => setVoidTarget(sale) }]
                                : []),
                              ...(isAdmin
                                ? [{ label: 'Delete', icon: Trash2Icon, variant: 'delete' as const, onClick: () => setArchiveTarget(sale) }]
                                : []),
                            ]}
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
      </div>

      {/* Invoice detail drawer */}
      {viewSale && (
        <Drawer
          title={`Bill #${viewSale.dailyInvoiceNumber}`}
          subtitle={`${formatDate(viewSale.createdAt)} · ${formatTime(viewSale.createdAt)}`}
          onClose={() => setViewSale(null)}
        >
          <div className="mx-auto max-w-xs font-mono text-xs text-slate-700">
            <div className="mb-1 flex justify-between font-semibold text-slate-500">
              <span className="w-1/2">Item</span>
              <span className="w-1/4 text-center">Qty</span>
              <span className="w-1/4 text-right">Amount</span>
            </div>
            <div className="space-y-1 border-t border-dashed border-slate-300 pt-1">
              {viewSale.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="w-1/2 truncate">{item.productName}</span>
                  <span className="w-1/4 text-center">{item.quantity}</span>
                  <span className="w-1/4 text-right">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-dashed border-slate-300 pt-2 text-sm font-bold text-slate-900">
              <span>TOTAL</span>
              <span>{formatCurrency(viewSale.totalAmount)}</span>
            </div>

            <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>Salesman</span>
                <span className="font-medium text-slate-700">{viewSale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Method</span>
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  {paymentLabel(viewSale).text}
                </span>
              </div>
              {viewSale.paymentMethod === 'CASH' && viewSale.cashReceived && (
                <div className="flex justify-between">
                  <span>Cash Received</span>
                  <span>{formatCurrency(viewSale.cashReceived)}</span>
                </div>
              )}
              {isAdmin && (
                <div className="flex justify-between">
                  <span>Profit</span>
                  <span className="font-medium text-slate-700">{formatCurrency(saleProfit(viewSale))}</span>
                </div>
              )}
            </div>
          </div>
        </Drawer>
      )}

      {/* Delete confirmation — hides from history only; revenue, profit, and
          inventory are untouched. Not a Return. */}
      {archiveTarget && (
        <ConfirmDialog
          title="Delete This Bill?"
          description={`Bill #${archiveTarget.dailyInvoiceNumber} will be deleted from Sales History. Revenue, profit, and financial records remain unchanged.`}
          confirmLabel={archiving ? 'Deleting...' : 'Delete Bill'}
          variant="danger"
          loading={archiving}
          onConfirm={handleArchive}
          onCancel={() => {
            setArchiveTarget(null);
            setArchiveReason('');
          }}
        >
          <label className={labelClass} htmlFor="archive-reason">
            Reason <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="archive-reason"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            placeholder="e.g. Duplicate entry, corrected in a later sale"
            rows={2}
            className={inputClass}
          />
        </ConfirmDialog>
      )}

      {/* Void confirmation — cancels the sale entirely: every item is
          restored to inventory (and, for a client sale, its balance is
          reversed). The bill stays visible here, marked Voided. */}
      {voidTarget && (
        <ConfirmDialog
          title={`Void Bill #${voidTarget.dailyInvoiceNumber}?`}
          description="This restores every item in this sale back to inventory and cancels it entirely. The bill stays in Sales History, marked Voided."
          confirmLabel={voiding ? 'Voiding...' : 'Void Sale'}
          variant="danger"
          loading={voiding}
          onConfirm={handleVoid}
          onCancel={() => {
            setVoidTarget(null);
            setVoidReason('');
          }}
        >
          <label className={labelClass} htmlFor="void-reason">
            Reason <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="void-reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Sale created by mistake"
            rows={2}
            className={inputClass}
          />
        </ConfirmDialog>
      )}
    </div>
  );
}
