'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getProducts, Product } from '@/lib/products';
import { createSale, Sale, PaymentMethod } from '@/lib/sales';
import { logout } from '@/lib/auth';

interface CartItem {
  product: Product;
  quantity: number;
}

const WALLET_PROVIDERS = ['JazzCash', 'Easypaisa', 'Sadapay', 'NayaPay', 'Other'];

export default function TerminalPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [editingReceipt, setEditingReceipt] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  // Payment modal state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [provider, setProvider] = useState(WALLET_PROVIDERS[0]);
  const [bankName, setBankName] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
    setLastAdded(product.name);
  }

  function handleScan(e: FormEvent) {
    e.preventDefault();
    const code = scanInput.trim().toLowerCase();
    if (!code) return;

    const found = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === code) ||
        p.sku.toLowerCase() === code,
    );

    if (found) {
      if (found.stockQty === 0) {
        setMessage(`"${found.name}" is out of stock.`);
        setLastAdded(null);
      } else {
        addToCart(found);
        setMessage(null);
      }
    } else {
      setMessage(`No product found for "${scanInput}"`);
      setLastAdded(null);
    }

    setScanInput('');
    scanRef.current?.focus();
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

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }

  const total = cart.reduce(
    (sum, c) => sum + parseFloat(c.product.salePrice) * c.quantity,
    0,
  );
  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );

  function openPaymentModal() {
    if (cart.length === 0) return;
    setPaymentMethod('CASH');
    setCashReceived(total.toFixed(2));
    setProvider(WALLET_PROVIDERS[0]);
    setBankName('');
    setPaymentError(null);
    setShowPayment(true);
  }

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeToReturn = cashReceivedNum - total;

  async function handleConfirmPayment() {
    setPaymentError(null);

    if (paymentMethod === 'CASH') {
      if (!cashReceived || cashReceivedNum < total) {
        setPaymentError('The full payment must be received before completing the sale.');
        return;
      }
    }

    setCheckingOut(true);
    try {
      const sale = await createSale({
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
        })),
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? cashReceivedNum : undefined,
        provider: paymentMethod === 'ONLINE_WALLET' ? provider : undefined,
        bankName: paymentMethod === 'BANK_TRANSFER' ? bankName : undefined,
      });
      setReceipt(sale);
      setEditingReceipt(false);
      setEditMessage(null);
      setCart([]);
      setLastAdded(null);
      setShowPayment(false);
      await loadProducts();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Checkout failed. Try again.',
      );
    } finally {
      setCheckingOut(false);
    }
  }

  function removeReceiptItem(itemId: string) {
    if (!receipt) return;
    const newItems = receipt.items.filter((i) => i.id !== itemId);
    const newTotal = newItems.reduce(
      (sum, i) => sum + parseFloat(i.lineTotal),
      0,
    );
    setReceipt({ ...receipt, items: newItems, totalAmount: newTotal.toFixed(2) });
  }

  function changeReceiptQty(itemId: string, delta: number) {
    if (!receipt) return;
    if (delta > 0) {
      const item = receipt.items.find((i) => i.id === itemId);
      if (item) {
        const product = products.find((p) => p.id === item.productId);
        const available = product ? product.stockQty : 0;
        if (item.quantity >= available) {
          setEditMessage(`Only ${available} in stock for "${item.productName}".`);
          return;
        }
      }
    }
    setEditMessage(null);
    const newItems = receipt.items
      .map((i) => {
        if (i.id !== itemId) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return null;
        const unit = parseFloat(i.unitPrice);
        return { ...i, quantity: newQty, lineTotal: (unit * newQty).toFixed(2) };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
    const newTotal = newItems.reduce(
      (sum, i) => sum + parseFloat(i.lineTotal),
      0,
    );
    setReceipt({ ...receipt, items: newItems, totalAmount: newTotal.toFixed(2) });
  }

  function addReceiptItem(product: Product) {
    if (!receipt) return;
    if (product.stockQty === 0) {
      setEditMessage(`"${product.name}" is out of stock.`);
      return;
    }
    const existing = receipt.items.find((i) => i.productId === product.id);
    if (existing && existing.quantity >= product.stockQty) {
      setEditMessage(`Only ${product.stockQty} in stock for "${product.name}".`);
      return;
    }
    setEditMessage(null);
    let newItems;
    if (existing) {
      newItems = receipt.items.map((i) =>
        i.productId === product.id
          ? {
              ...i,
              quantity: i.quantity + 1,
              lineTotal: (parseFloat(i.unitPrice) * (i.quantity + 1)).toFixed(2),
            }
          : i,
      );
    } else {
      newItems = [
        ...receipt.items,
        {
          id: `temp-${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          lineTotal: product.salePrice,
        },
      ];
    }
    const newTotal = newItems.reduce(
      (sum, i) => sum + parseFloat(i.lineTotal),
      0,
    );
    setReceipt({ ...receipt, items: newItems, totalAmount: newTotal.toFixed(2) });
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const paymentMethods: { key: PaymentMethod; label: string; icon: string }[] = [
    { key: 'CASH', label: 'Cash', icon: '💵' },
    { key: 'CARD', label: 'Card', icon: '💳' },
    { key: 'ONLINE_WALLET', label: 'Online Wallet', icon: '📱' },
    { key: 'BANK_TRANSFER', label: 'Bank Transfer', icon: '🏦' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 text-lg text-white shadow-md">
              🛒
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">POS Terminal</h1>
              <p className="text-xs text-slate-500">Shoaib Mart · Cash & Carry</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 p-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                📷
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Scan Barcode
                </h2>
                <p className="text-xs text-slate-500">
                  Scan or type SKU, then press Enter
                </p>
              </div>
            </div>
            <form onSubmit={handleScan} className="flex gap-3">
              <input
                ref={scanRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan barcode / SKU..."
                autoFocus
                className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-base text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                className="rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-md transition hover:shadow-lg active:scale-95"
              >
                Add
              </button>
            </form>

            {lastAdded && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  ✓
                </span>
                Added: {lastAdded}
              </div>
            )}
            {message && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  !
                </span>
                {message}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              onClick={() => setShowProducts((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-slate-700"
            >
              <span className="flex items-center gap-2">
                <span className="text-slate-400">📦</span>
                Browse products (manual add)
              </span>
              <span className="text-slate-400">{showProducts ? '▲' : '▼'}</span>
            </button>

            {showProducts && (
              <div className="border-t border-slate-100 p-4">
                {/* Search by name */}
                <div className="mb-3">
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="🔍 Search product by name..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {loading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-sm text-slate-400">No products found.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredProducts.map((p) => {
                      const out = p.stockQty === 0;
                      const low = !out && p.stockQty <= p.reorderLevel;
                      return (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          disabled={out}
                          className="group relative rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-md disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
                        >
                          <div className="text-sm font-semibold text-slate-900">
                            {p.name}
                          </div>
                          <div className="mt-0.5 text-sm text-blue-600">
                            Rs {p.salePrice}
                          </div>
                          <div className="mt-2 flex items-center gap-1">
                            {out ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                Out of stock
                              </span>
                            ) : low ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                Low · {p.stockQty}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                Stock: {p.stockQty}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                🧾 Current Sale
              </h2>
              {itemCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {itemCount} item{itemCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
                  🛒
                </div>
                <p className="text-sm font-medium text-slate-700">Cart is empty</p>
                <p className="mt-1 text-xs text-slate-400">
                  Scan a product to start a sale
                </p>
              </div>
            ) : (
              <>
                <div className="max-h-[45vh] space-y-2 overflow-y-auto px-4 py-3">
                  {cart.map((c) => (
                    <div
                      key={c.product.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <div className="text-sm font-semibold text-slate-900">
                            {c.product.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Rs {c.product.salePrice} each
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(c.product.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm">
                          <button
                            onClick={() => changeQty(c.product.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-slate-900">
                            {c.quantity}
                          </span>
                          <button
                            onClick={() => changeQty(c.product.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          Rs {(parseFloat(c.product.salePrice) * c.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-4">
                  <div className="mb-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Items</span>
                      <span>{itemCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-slate-900">
                        Total
                      </span>
                      <span className="text-2xl font-bold text-slate-900">
                        Rs {total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={openPaymentModal}
                    disabled={checkingOut}
                    className="w-full rounded-xl bg-linear-to-br from-emerald-500 to-green-600 py-3.5 text-base font-semibold text-white shadow-md transition hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
                  >
                    Checkout · Rs {total.toFixed(2)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-slate-900">Payment</h2>
            <p className="mb-4 text-sm text-slate-500">
              Total Bill:{' '}
              <span className="text-lg font-bold text-slate-900">
                Rs {total.toFixed(2)}
              </span>
            </p>

            <div className="mb-4 grid grid-cols-2 gap-3">
              {paymentMethods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 transition ${
                    paymentMethod === m.key
                      ? 'border-blue-600 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <span
                    className={`text-sm font-medium ${
                      paymentMethod === m.key ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {paymentMethod === 'CASH' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Cash Received
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {cashReceivedNum > 0 && (
                    <div
                      className={`rounded-xl p-3 text-sm font-semibold ${
                        changeToReturn >= 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {changeToReturn >= 0
                        ? `Change to return: Rs ${changeToReturn.toFixed(2)}`
                        : `Short by: Rs ${Math.abs(changeToReturn).toFixed(2)}`}
                    </div>
                  )}
                </>
              )}

              {paymentMethod === 'CARD' && (
                <div className="rounded-xl bg-blue-50 p-4 text-center">
                  <p className="text-sm text-slate-600">Amount to charge</p>
                  <p className="text-2xl font-bold text-slate-900">
                    Rs {total.toFixed(2)}
                  </p>
                </div>
              )}

              {paymentMethod === 'ONLINE_WALLET' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Wallet Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    >
                      {WALLET_PROVIDERS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-4 text-center">
                    <p className="text-sm text-slate-600">Amount to receive</p>
                    <p className="text-2xl font-bold text-slate-900">
                      Rs {total.toFixed(2)}
                    </p>
                  </div>
                </>
              )}

              {paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Bank Name
                    </label>
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="HBL"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 text-center">
                    <p className="text-sm text-slate-600">Amount to receive</p>
                    <p className="text-2xl font-bold text-slate-900">
                      Rs {total.toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {paymentError && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {paymentError}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={checkingOut}
                className="flex-1 rounded-xl bg-linear-to-br from-emerald-500 to-green-600 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
              >
                {checkingOut ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm print:bg-white print:p-0 print:backdrop-blur-none">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl print:max-w-full print:shadow-none">
            <div
              id="receipt-print"
              className="mx-auto font-mono text-slate-900"
              style={{ width: '280px' }}
            >
              <div className="mb-3 text-center">
                <h2 className="text-base font-bold tracking-wide">SHOAIB MART</h2>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  Cash &amp; Carry
                </p>
                <p className="mt-1 text-[10px] font-semibold text-slate-700">
                  Bill #{receipt.dailyInvoiceNumber}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {new Date(receipt.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="border-t border-dashed border-slate-400 pt-2 text-[11px]">
                <div className="flex justify-between font-semibold text-slate-600">
                  <span className="w-1/2">Item</span>
                  <span className="w-1/4 text-center">Qty</span>
                  <span className="w-1/4 text-right">Amount</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-400 py-2 text-[11px]">
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1">
                    <span className="w-1/2 truncate">{item.productName}</span>
                    {editingReceipt ? (
                      <span className="flex w-1/4 items-center justify-center gap-1 print:hidden">
                        <button
                          onClick={() => changeReceiptQty(item.id, -1)}
                          className="flex h-4 w-4 items-center justify-center rounded bg-slate-200 text-[10px] text-slate-700"
                        >
                          −
                        </button>
                        {item.quantity}
                        <button
                          onClick={() => changeReceiptQty(item.id, 1)}
                          className="flex h-4 w-4 items-center justify-center rounded bg-slate-200 text-[10px] text-slate-700"
                        >
                          +
                        </button>
                      </span>
                    ) : (
                      <span className="w-1/4 text-center">{item.quantity}</span>
                    )}
                    <span className="w-1/4 text-right">{item.lineTotal}</span>
                    {editingReceipt && (
                      <button
                        onClick={() => removeReceiptItem(item.id)}
                        className="ml-1 text-red-600 print:hidden"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-400 pt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>TOTAL</span>
                  <span>Rs {receipt.totalAmount}</span>
                </div>
              </div>

              <div className="mt-2 border-t border-dashed border-slate-400 pt-2 text-[10px] text-slate-600">
                <div className="flex justify-between">
                  <span>Payment</span>
                  <span className="font-semibold">
                    {receipt.paymentMethod === 'CASH' && 'Cash'}
                    {receipt.paymentMethod === 'CARD' && 'Card'}
                    {receipt.paymentMethod === 'ONLINE_WALLET' &&
                      `${receipt.provider ?? 'Wallet'}`}
                    {receipt.paymentMethod === 'BANK_TRANSFER' &&
                      `Bank${receipt.bankName ? ` (${receipt.bankName})` : ''}`}
                  </span>
                </div>
                {receipt.paymentMethod === 'CASH' && receipt.cashReceived && (
                  <>
                    <div className="flex justify-between">
                      <span>Cash Received</span>
                      <span>Rs {receipt.cashReceived}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Change</span>
                      <span>
                        Rs{' '}
                        {(
                          parseFloat(receipt.cashReceived) -
                          parseFloat(receipt.totalAmount)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-3 text-center text-[10px] text-slate-500">
                Thank you for shopping!
              </p>
            </div>

            {editingReceipt && (
              <div className="mt-4 border-t border-slate-200 pt-4 print:hidden">
                {editMessage && (
                  <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {editMessage}
                  </div>
                )}
                <p className="mb-2 text-xs font-semibold text-slate-600">Add product</p>
                <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addReceiptItem(p)}
                      disabled={p.stockQty === 0}
                      className="rounded-lg border border-slate-200 p-2 text-left text-xs transition hover:border-blue-400 disabled:opacity-50"
                    >
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-slate-500">
                        Rs {p.salePrice} · {p.stockQty}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                Print
              </button>
              <button
                onClick={() => {
                  setEditingReceipt((v) => !v);
                  setEditMessage(null);
                }}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {editingReceipt ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={() => {
                  setReceipt(null);
                  setEditingReceipt(false);
                  setEditMessage(null);
                }}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}