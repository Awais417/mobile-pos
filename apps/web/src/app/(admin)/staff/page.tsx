'use client';

import { useEffect, useState, FormEvent } from 'react';
import { getStaff, createStaff, Staff } from '@/lib/staff';
import { AlertTriangleIcon, InboxIcon, PlusIcon, UsersIcon } from '@/components/icons';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100';

function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || 'U';
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'CASHIER'>('CASHIER');

  async function loadStaff() {
    try {
      const data = await getStaff();
      setStaff(data);
    } catch {
      setError('Could not load staff.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createStaff({ fullName, email, password, role });
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('CASHIER');
      await loadStaff();
    } catch {
      setError('Could not add staff. Email may already be used.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
          <p className="text-sm text-slate-500">
            Manage cashiers and managers who can access this business
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 text-sm font-semibold text-slate-800">
            Add new staff member
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              required
              className={inputClass}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
              className={inputClass}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8)"
              type="password"
              required
              minLength={8}
              className={inputClass}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'MANAGER' | 'CASHIER')}
              className={inputClass}
            >
              <option value="CASHIER">Cashier</option>
              <option value="MANAGER">Manager</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                'Adding...'
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  Add
                </>
              )}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <InboxIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No staff yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Add your first team member using the form above
              </p>
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-165 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                            {initials(s.fullName)}
                          </div>
                          <span className="font-medium text-slate-900">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{s.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <UsersIcon className="h-3 w-3" />
                          {s.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              s.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {s.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
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
