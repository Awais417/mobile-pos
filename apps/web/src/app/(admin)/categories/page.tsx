'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  getCategories,
  createCategory,
  deleteCategory,
  Category,
} from '@/lib/categories';
import { AlertTriangleIcon, InboxIcon, PlusIcon, Trash2Icon, TagIcon } from '@/components/icons';

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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Group your products for faster browsing and filtering
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form
          onSubmit={handleAdd}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name (e.g. Drinks)"
            required
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              'Adding...'
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                Add category
              </>
            )}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <InboxIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No categories yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Add your first category using the form above
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 font-medium text-slate-900">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <TagIcon className="h-3.5 w-3.5" />
                        </span>
                        {c.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        aria-label={`Delete ${c.name}`}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
