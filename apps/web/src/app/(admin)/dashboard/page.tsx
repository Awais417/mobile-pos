'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function DashboardPage() {
  const { user, loading } = useCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Welcome back 👋</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : user ? (
          <div className="space-y-2 text-sm text-gray-700">
            <p><span className="font-medium">Role:</span> {user.role}</p>
            <p><span className="font-medium">Business ID:</span> {user.businessId}</p>
          </div>
        ) : (
          <p className="text-red-600">Could not load user.</p>
        )}
      </div>
    </div>
  );
}