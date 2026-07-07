'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getSalesSummary, SalesSummary } from '@/lib/reports';

export default function DashboardPage() {
  const { user, loading } = useCurrentUser();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    getSalesSummary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  const cards = [
    {
      label: 'Total Revenue',
      value: summary ? `Rs ${summary.totalRevenue}` : '—',
      icon: '💰',
      color: 'bg-green-50 text-green-700',
    },
    {
      label: 'Total Sales',
      value: summary ? summary.totalSales : '—',
      icon: '🧾',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Items Sold',
      value: summary ? summary.totalItemsSold : '—',
      icon: '📦',
      color: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Report cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div
              className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg ${c.color}`}
            >
              {c.icon}
            </div>
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {summaryLoading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* User info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Account</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : user ? (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">Role:</span> {user.role}
            </p>
            <p>
              <span className="font-medium">Business ID:</span>{' '}
              {user.businessId}
            </p>
          </div>
        ) : (
          <p className="text-red-600">Could not load user.</p>
        )}
      </div>
    </div>
  );
}