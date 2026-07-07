'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  getCategories,
  createCategory,
  deleteCategory,
  Category,
} from '@/lib/categories';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      setError('Could not load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCategory(name);
      setName('');
      await load();
    } catch {
      setError('Could not add. Category may already exist.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCategory(id);
    await load();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Categories</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="mb-6 flex gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name (e.g. Drinks)"
          required
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="p-4 text-gray-500">No categories yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium text-gray-900">{c.name}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
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