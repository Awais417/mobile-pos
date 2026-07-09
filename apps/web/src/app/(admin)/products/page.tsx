'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  Product,
} from '@/lib/products';
import { getCategories, Category } from '@/lib/categories';

const emptyForm = {
  name: '',
  sku: '',
  costPrice: '',
  salePrice: '',
  stockQty: '',
  reorderLevel: '',
  categoryId: '',
};

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
      name: p.name,
      sku: p.sku,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      stockQty: String(p.stockQty),
      reorderLevel: String(p.reorderLevel),
      categoryId: p.categoryId ?? '',
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
      ? p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      : true;
    return matchCategory && matchSearch;
  });

  const lowStockCount = products.filter(isLowStock).length;
  const inputClass =
    'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Products</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && lowStockCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <span>⚠️</span>
          <span>
            <strong>{lowStockCount}</strong> product
            {lowStockCount > 1 ? 's are' : ' is'} low on stock.
          </span>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="mb-3 text-sm font-medium text-gray-700">
          {editingId ? 'Edit product' : 'Add new product'}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
            className={`${inputClass} disabled:bg-gray-100`}
          />
          <select
            value={form.categoryId}
            onChange={(e) => updateField('categoryId', e.target.value)}
            className={inputClass}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            placeholder="Reorder at"
            type="number"
            className={inputClass}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Search + Filter */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by name or SKU..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="p-4 text-gray-500">No products found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Category</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Sale</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Reorder</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium text-gray-900">{p.name}</td>
                  <td className="p-3 text-gray-600">{p.sku}</td>
                  <td className="p-3 text-gray-600">
                    {categoryName(p.categoryId)}
                  </td>
                  <td className="p-3 text-gray-600">{p.costPrice}</td>
                  <td className="p-3 text-gray-600">{p.salePrice}</td>
                  <td className="p-3">
                    <span className="text-gray-600">{p.stockQty}</span>
                    {isLowStock(p) && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Low
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{p.reorderLevel}</td>
                  <td className="p-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
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