'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, Product } from '@/lib/products';
import { createSale, Sale } from '@/lib/sales';
import { logout } from '@/lib/auth';

interface CartItem {
  product: Product;
  quantity: number;
}

export default function TerminalPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      setMessage('Could not load products.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.product.id === productId
            ? { ...c, quantity: c.quantity + delta }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }

  const total = cart.reduce(
    (sum, c) => sum + parseFloat(c.product.salePrice) * c.quantity,
    0,
  );

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setMessage(null);
    try {
      const sale = await createSale(
        cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
      );
      setReceipt(sale); // receipt dikhao
      setCart([]);
      await loadProducts();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Checkout failed. Try again.',
      );
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <h1 className="text-lg font-semibold text-slate-900">POS Terminal</h1>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Logout
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Products */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-slate-900">Products</h2>
          {message && (
            <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {message}
            </div>
          )}
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stockQty === 0}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-400 disabled:opacity-50"
                >
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-sm text-slate-500">Rs {p.salePrice}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Stock: {p.stockQty}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Cart</h2>
          {cart.length === 0 ? (
            <p className="text-sm text-slate-500">
              Cart is empty. Tap a product.
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((c) => (
                <div
                  key={c.product.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {c.product.name}
                    </div>
                    <div className="text-slate-500">
                      Rs {c.product.salePrice}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeQty(c.product.id, -1)}
                      className="h-6 w-6 rounded bg-slate-200 text-slate-700"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-slate-900">
                      {c.quantity}
                    </span>
                    <button
                      onClick={() => changeQty(c.product.id, 1)}
                      className="h-6 w-6 rounded bg-slate-200 text-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Total</span>
                  <span>Rs {total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {checkingOut ? 'Processing...' : 'Checkout'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6">
            <div id="receipt-print">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-bold text-slate-900">Receipt</h2>
                <p className="text-xs text-slate-500">
                  {new Date(receipt.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-1 border-y border-dashed border-slate-300 py-3 text-sm">
                {receipt.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-slate-700"
                  >
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                    <span>Rs {item.lineTotal}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span>Rs {receipt.totalAmount}</span>
              </div>

              <p className="mt-4 text-center text-xs text-slate-400">
                Thank you for your purchase!
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Print
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}