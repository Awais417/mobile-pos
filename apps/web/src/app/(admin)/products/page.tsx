'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  getProducts,
  createProduct,
  deleteProduct,
  Product,
} from '@/lib/products';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      setError('Could not load products.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProduct({
        name,
        sku,
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        stockQty: stockQty ? parseInt(stockQty) : 0,
      });
      setName('');
      setSku('');
      setCostPrice('');
      setSalePrice('');
      setStockQty('');
      await loadProducts();
    } catch {
      setError('Could not add product. Check SKU is unique.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteProduct(id);
    await loadProducts();
  }

  // Stock alert helper: product low-stock hai?
  function isLowStock(p: Product): boolean {
    return p.stockQty <= p.reorderLevel;
  }

  // Kitne products low stock mein hain
  const lowStockCount = products.filter(isLowStock).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Products</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stock alert summary */}
      {!loading && lowStockCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <span>⚠️</span>
          <span>
            <strong>{lowStockCount}</strong> product
            {lowStockCount > 1 ? 's are' : ' is'} low on stock.
          </span>
        </div>
      )}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-6"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          placeholder="Cost"
          type="number"
          step="0.01"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="Sale"
          type="number"
          step="0.01"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Adding...' : 'Add'}
        </button>
      </form>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : products.length === 0 ? (
          <p className="p-4 text-gray-500">No products yet. Add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Sale</th>
                <th className="p-3">Stock</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="p-3 font-medium text-gray-900">{p.name}</td>
                  <td className="p-3 text-gray-600">{p.sku}</td>
                  <td className="p-3 text-gray-600">{p.costPrice}</td>
                  <td className="p-3 text-gray-600">{p.salePrice}</td>
                  <td className="p-3">
                    <span className="text-gray-600">{p.stockQty}</span>
                    {isLowStock(p) && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Low Stock
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(p.id)}
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