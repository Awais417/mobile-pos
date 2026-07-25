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
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatCurrency, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { SkeletonCard } from '@/components/ui/Skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);

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
    </div>
  );
}
