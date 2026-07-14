'use client';

import { useEffect, useState } from 'react';
import { getSales, deleteSale, Sale, PaymentMethod } from '@/lib/sales';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  WalletIcon,
  ReceiptIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  SmartphoneIcon,
  LandmarkIcon,
  InboxIcon,
  AlertTriangleIcon,
} from '@/components/icons';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';

type DateFilterKey = 'today' | 'week' | 'month' | 'all';
type PaymentFilterKey = PaymentMethod | 'ALL';

const DATE_FILTERS: { key: DateFilterKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

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

function isInRange(dateStr: string, key: DateFilterKey): boolean {
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
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
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
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
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

export default function SalesHistoryPage() {
  const { user } = useCurrentUser();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('today');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterKey>('ALL');

  useEffect(() => {
    getSales()
      .then(setSales)
      .catch(() => setError('Could not load sales.'))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this bill?')) {
      return;
    }
    try {
      await deleteSale(id);
      setSales((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert('Could not delete this bill.');
    }
  }

  const filteredSales = sales.filter((s) => {
    const dateMatch = isInRange(s.createdAt, dateFilter);
    const paymentMatch =
      paymentFilter === 'ALL' || s.paymentMethod === paymentFilter;
    return dateMatch && paymentMatch;
  });

  const summary = filteredSales.reduce(
    (acc, s) => {
      acc.total += parseFloat(s.totalAmount);
      acc.count += 1;
      return acc;
    },
    { total: 0, count: 0 },
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Sales History</h1>
          <p className="text-sm text-slate-500">
            View and track all completed transactions
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                dateFilter === f.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {PAYMENT_FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setPaymentFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                  paymentFilter === f.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <WalletIcon className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-500">Total Amount</div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">
              Rs {summary.total.toFixed(2)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <ReceiptIcon className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-500">Number of Sales</div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">
              {summary.count}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-500">Paid</div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">
              {summary.count}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ClockIcon className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-500">Unpaid / Partial</div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">0</div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-14 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <InboxIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">No sales found</p>
            <p className="mt-1 text-xs text-slate-400">
              No transactions match this filter
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSales.map((sale) => {
              const isOpen = expandedId === sale.id;
              const pay = paymentLabel(sale);
              return (
                <div
                  key={sale.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <ReceiptIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-900">
                            Bill #{sale.dailyInvoiceNumber}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Paid
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            <pay.icon className="h-3 w-3" />
                            {pay.text}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {formatDate(sale.createdAt)} · {formatTime(sale.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">
                          {sale.items.length} item
                          {sale.items.length > 1 ? 's' : ''}
                        </div>
                        <div className="text-lg font-bold text-slate-900">
                          Rs {sale.totalAmount}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleExpand(sale.id)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                        {user?.role === 'ADMIN' && (
                          <button
                            onClick={() => handleDelete(sale.id)}
                            className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-dashed border-slate-200 bg-slate-50/60 p-4">
                      <div className="mx-auto max-w-xs font-mono text-xs text-slate-700">
                        <div className="mb-1 flex justify-between font-semibold text-slate-500">
                          <span className="w-1/2">Item</span>
                          <span className="w-1/4 text-center">Qty</span>
                          <span className="w-1/4 text-right">Amount</span>
                        </div>
                        <div className="space-y-1 border-t border-dashed border-slate-300 pt-1">
                          {sale.items.map((item) => (
                            <div key={item.id} className="flex justify-between">
                              <span className="w-1/2 truncate">
                                {item.productName}
                              </span>
                              <span className="w-1/4 text-center">
                                {item.quantity}
                              </span>
                              <span className="w-1/4 text-right">
                                {item.lineTotal}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex justify-between border-t border-dashed border-slate-300 pt-2 text-sm font-bold text-slate-900">
                          <span>TOTAL</span>
                          <span>Rs {sale.totalAmount}</span>
                        </div>

                        <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-500">
                          <div className="flex justify-between">
                            <span>Payment Method</span>
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <pay.icon className="h-3 w-3" /> {pay.text}
                            </span>
                          </div>
                          {sale.paymentMethod === 'CASH' && sale.cashReceived && (
                            <>
                              <div className="flex justify-between">
                                <span>Cash Received</span>
                                <span>Rs {sale.cashReceived}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Change Given</span>
                                <span>
                                  Rs{' '}
                                  {(
                                    parseFloat(sale.cashReceived) -
                                    parseFloat(sale.totalAmount)
                                  ).toFixed(2)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}