'use client';

import { useEffect, useState, FormEvent } from 'react';
import { getStaff, createStaff, Staff } from '@/lib/staff';

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

  const inputClass =
    'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Staff</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="mb-3 text-sm font-medium text-gray-700">
          Add new staff member
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : staff.length === 0 ? (
          <p className="p-4 text-gray-500">No staff yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium text-gray-900">{s.fullName}</td>
                  <td className="p-3 text-gray-600">{s.email}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {s.role}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">
                    {s.isActive ? 'Active' : 'Disabled'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}