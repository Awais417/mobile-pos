'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
} from '@/lib/products';
import { getCategories, Category } from '@/lib/categories';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from '@/components/icons';

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  costPrice: '',
  salePrice: '',
  stockQty: '',
  reorderLevel: '',
  categoryId: '',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100';

// Searchable category dropdown — type karke filter karein
function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = 'Search category...',
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedName = categories.find((c) => c.id === value)?.name ?? '';

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={open ? query : selectedName}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        placeholder={value ? selectedName : placeholder}
        className={`${inputClass} pr-9`}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
              setQuery('');
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
          >
            No category
          </button>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No match found</div>
          ) : (
            filtered.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  c.id === value ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600'
                }`}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  async function loadData() {
    try {
      const [prods, cats] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch {
      setError('Could not load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      costPrice: p.costPrice || '',
      salePrice: p.salePrice || '',
      stockQty: p.stockQty != null ? String(p.stockQty) : '',
      reorderLevel: p.reorderLevel != null ? String(p.reorderLevel) : '',
      categoryId: p.categoryId || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        barcode: form.barcode || undefined,
        costPrice: parseFloat(form.costPrice),
        salePrice: parseFloat(form.salePrice),
        stockQty: form.stockQty ? parseInt(form.stockQty) : 0,
        reorderLevel: form.reorderLevel ? parseInt(form.reorderLevel) : 0,
        categoryId: form.categoryId || undefined,
      };

      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await createProduct({ ...payload, sku: form.sku });
      }
      cancelEdit();
      await loadData();
    } catch {
      setError(
        editingId
          ? 'Could not update product.'
          : 'Could not add product. Check SKU is unique.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteProduct(id);
    await loadData();
  }

  function isLowStock(p: Product): boolean {
    return p.stockQty <= p.reorderLevel;
  }

  function categoryName(id: string | null): string {
    if (!id) return '—';
    return categories.find((c) => c.id === id)?.name ?? '—';
  }

  const filteredProducts = products.filter((p) => {
    const matchCategory = filterCategory
      ? p.categoryId === filterCategory
      : true;
    const q = search.trim().toLowerCase();
    const matchSearch = q
      ? p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
      : true;
    return matchCategory && matchSearch;
  });

  const lowStockCount = products.filter(isLowStock).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">
            Manage your catalog, pricing and stock levels
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && lowStockCount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>
              <strong>{lowStockCount}</strong> product
              {lowStockCount > 1 ? 's are' : ' is'} low on stock.
            </span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 text-sm font-semibold text-slate-800">
            {editingId ? 'Edit product' : 'Add new product'}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Name"
              required
              className={inputClass}
            />
            <input
              value={form.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              placeholder="SKU"
              required
              disabled={!!editingId}
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
            />
            {/* Searchable category picker */}
            <CategoryPicker
              categories={categories}
              value={form.categoryId}
              onChange={(id) => updateField('categoryId', id)}
            />
            <input
              value={form.costPrice}
              onChange={(e) => updateField('costPrice', e.target.value)}
              placeholder="Cost price"
              type="number"
              step="0.01"
              required
              className={inputClass}
            />
            <input
              value={form.salePrice}
              onChange={(e) => updateField('salePrice', e.target.value)}
              placeholder="Sale price"
              type="number"
              step="0.01"
              required
              className={inputClass}
            />
            <input
              value={form.stockQty}
              onChange={(e) => updateField('stockQty', e.target.value)}
              placeholder="Stock qty"
              type="number"
              className={inputClass}
            />
            <input
              value={form.reorderLevel}
              onChange={(e) => updateField('reorderLevel', e.target.value)}
              placeholder="Stock Alert At"
              type="number"
              className={inputClass}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                'Saving...'
              ) : editingId ? (
                'Update product'
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  Add product
                </>
              )}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Search + Filter */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU or barcode..."
              className={`${inputClass} pl-10`}
            />
          </div>
          {categories.length > 0 && (
            <div className="sm:w-64">
              <CategoryPicker
                categories={categories}
                value={filterCategory}
                onChange={setFilterCategory}
                placeholder="Filter by category..."
              />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-14 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <InboxIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No products found</p>
              <p className="mt-1 text-xs text-slate-400">
                Try adjusting your search or add a new product above
              </p>
            </div>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-205 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Sale</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Stock Alert</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {categoryName(p.categoryId)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.costPrice}</td>
                      <td className="px-4 py-3 text-slate-500">{p.salePrice}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{p.stockQty}</span>
                        {isLowStock(p) && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                            Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.reorderLevel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(p)}
                            aria-label={`Edit ${p.name}`}
                            className="cursor-pointer rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-[#86efac] hover:bg-[#f0fdf4] hover:text-[#16a34a] focus-visible:border-[#86efac] focus-visible:bg-[#f0fdf4] focus-visible:text-[#16a34a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86efac]"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            aria-label={`Delete ${p.name}`}
                            className="cursor-pointer rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </button>
                        </div>
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
