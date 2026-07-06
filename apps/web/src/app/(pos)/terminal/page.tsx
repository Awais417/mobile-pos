'use client';

import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logout } from '@/lib/auth';

export default function TerminalPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <h1 className="text-lg font-semibold text-slate-900">POS Terminal</h1>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Logout
        </button>
      </header>

      {/* Content */}
      <main className="p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Cashier Terminal 🧾
          </h2>

          {loading ? (
            <p className="text-slate-500">Loading your details...</p>
          ) : user ? (
            <div className="space-y-2 text-sm">
              <p className="text-slate-700">
                <span className="font-medium">Role:</span> {user.role}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">Business ID:</span>{' '}
                {user.businessId}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">Outlet ID:</span>{' '}
                {user.outletId ?? 'Not assigned'}
              </p>
            </div>
          ) : (
            <p className="text-red-600">Could not load user details.</p>
          )}

          {/* Placeholder — yahan baad mein billing aayega */}
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-slate-400">
              Billing & checkout coming soon in the next phase.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}