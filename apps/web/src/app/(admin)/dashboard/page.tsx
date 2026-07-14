'use client';

import { useEffect, useState } from 'react';
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
import {
  WalletIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ReceiptIcon,
  BoxesIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(1);

  useEffect(() => {
    setLoading(true);
    getDashboard(days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

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
    trend?: string;
    trendColor?: string;
  }[] = kpis
    ? [
        {
          label: `Sales (${selectedLabel})`,
          value: `Rs ${kpis.periodRevenue}`,
          icon: WalletIcon,
          color: 'bg-emerald-50 text-emerald-600',
          trend: `${Math.abs(changePct).toFixed(1)}% vs previous period`,
          trendColor: isUp ? 'text-emerald-600' : 'text-red-600',
        },
        {
          label: isLoss ? 'Loss' : 'Profit',
          value: `Rs ${Math.abs(periodProfitNum).toFixed(2)}`,
          icon: isLoss ? TrendingDownIcon : TrendingUpIcon,
          color: isLoss ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
        },
        {
          label: 'Orders',
          value: kpis.periodOrders,
          icon: ReceiptIcon,
          color: 'bg-purple-50 text-purple-600',
        },
        {
          label: 'Avg Order Value',
          value: `Rs ${kpis.avgOrderValue}`,
          icon: WalletIcon,
          color: 'bg-amber-50 text-amber-600',
        },
        {
          label: 'Inventory Value',
          value: `Rs ${kpis.inventoryValue}`,
          icon: BoxesIcon,
          color: 'bg-slate-100 text-slate-600',
        },
        {
          label: 'Low Stock Alerts',
          value: kpis.lowStockCount,
          icon: AlertTriangleIcon,
          color: 'bg-red-50 text-red-600',
        },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">
              Business overview and analytics
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDays(opt.key)}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  days === opt.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))
            : kpiCards.map((c) => {
                const Icon = c.icon;
                const TrendIcon = isUp ? TrendingUpIcon : TrendingDownIcon;
                return (
                  <div
                    key={c.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div
                      className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm text-slate-500">{c.label}</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">
                      {c.value}
                    </div>
                    {c.trend && (
                      <div
                        className={`mt-1 flex items-center gap-1 text-xs font-medium ${c.trendColor}`}
                      >
                        <TrendIcon className="h-3.5 w-3.5" />
                        {c.trend}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>

        {/* Revenue Trend Chart */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">
            Revenue &amp; Profit Trend
          </h2>
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
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  labelFormatter={(v) => fmtDate(v as string)}
                  formatter={(value, name) => {
                    const num = Number(value);
                    if (name === 'Profit' && num < 0) {
                      return [
                        `Rs ${Math.abs(num).toFixed(2)} (Loss)`,
                        'Profit/Loss',
                      ];
                    }
                    return [`Rs ${value}`, name];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#3b82f6"
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

        {/* Payment Distribution */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">
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
                    <Tooltip formatter={(v) => `Rs ${v}`} />
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
                          Rs {p.amount} · {p.count} txn
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
            <h2 className="mb-4 font-semibold text-slate-900">
              Low Stock Alerts
            </h2>
            {loading ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ) : data && data.lowStockProducts.length > 0 ? (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {data.lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {p.name}
                    </span>
                    <span className="text-xs font-semibold text-red-600">
                      {p.stockQty} left (alert at {p.reorderLevel})
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
      </div>
    </div>
  );
}