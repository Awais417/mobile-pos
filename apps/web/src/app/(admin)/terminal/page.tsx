'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import { getProducts, Product } from '@/lib/products';
import { getCategories, Category } from '@/lib/categories';
import { createSale, Sale, PaymentMethod } from '@/lib/sales';
import { getClients, createClient, ClientListItem } from '@/lib/clients';
import {
  getProductUnits,
  searchByImei,
  ProductUnit,
  DeviceCondition,
} from '@/lib/product-units';
import { formatCurrency, formatNumber, toWholeRupees } from '@/lib/format';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  stripDecimalPoint,
  blockDecimalKeyDown,
  blockDecimalPaste,
} from '@/lib/whole-number-input';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeletons';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CreditCardIcon,
  InboxIcon,
  LandmarkIcon,
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  Trash2Icon,
  UserIcon,
  WalletIcon,
  XIcon,
} from '@/components/icons';

interface CartItem {
  key: string;
  product: Product;
  unit?: ProductUnit;
  quantity: number;
  /** Numeric price used for all calculations — 0 while the price input is empty/invalid. */
  price: number;
  /** Raw text shown in the price input, kept separate from `price` so clearing the field doesn't get forced back to "0". */
  priceInput: string;
  /** Becomes true on blur (or a checkout attempt) — gates when the "required" error is shown. */
  priceTouched: boolean;
}

const WALLET_PROVIDERS = [
  'JazzCash',
  'Easypaisa',
  'Sadapay',
  'NayaPay',
  'Other',
];

// Temporarily hides only the Grand Total Edit trigger — the label, amount,
// and all editing logic/state (startEditTotal/saveEditedTotal/etc.) stay
// exactly as they are; flip back to true to restore the button.
const SHOW_GRAND_TOTAL_EDIT = false;

const CONDITION_LABELS: Record<DeviceCondition, string> = {
  BRAND_NEW: 'Brand New',
  BRAND_NEW_PIN_PACK: 'Brand New / Pin Pack',
  OPEN_BOX: 'Open Box',
  USED: 'Used',
  REFURBISHED: 'Refurbished',
  CPO: 'CPO',
};

export default function TerminalPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';
  // Cost Price in the cart is also allowed for Salesman (unlike the
  // customer-facing receipt, which stays ADMIN-only — see sales.service.ts).
  const isSalesman = user?.role === 'SALESMAN';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [receiptClientInfo, setReceiptClientInfo] = useState<{
    fullName: string;
    phone: string;
    amountPaid: number;
    remainingBalance: number;
  } | null>(null);
  const [editingReceipt, setEditingReceipt] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [closingReceipt, setClosingReceipt] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const receiptModalRef = useRef<HTMLDivElement>(null);
  const receiptCloseButtonRef = useRef<HTMLButtonElement>(null);
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Device picker (jab phone/serialized product select ho)
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pickerUnits, setPickerUnits] = useState<ProductUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  // Multi-select within the picker — tracked by ProductUnit.id (never the
  // grouped Product ID) so each physical device is selected independently.
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingPicker, setConfirmingPicker] = useState(false);

  // Grand Total edit — lets the cashier manually set the final payable total
  // at checkout. `subtotal` (the cart's own item-price sum) is never touched;
  // this is a top-level override on top of it. `null` means "use the
  // calculated subtotal as-is". Reset whenever the cart itself changes, so a
  // stale override never silently carries over onto a different set of items.
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState('');

  useEffect(() => {
    setTotalOverride(null);
    setEditingTotal(false);
    setTotalInput('');
  }, [cart]);

  // Payment modal state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [provider, setProvider] = useState(WALLET_PROVIDERS[0]);
  const [bankName, setBankName] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Client selection — null = walk-in (existing/default behavior). Chosen
  // once per sale; cleared whenever the cart is cleared/a sale completes.
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientListItem | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientNote, setNewClientNote] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [clientPickerError, setClientPickerError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [prods, cats] = await Promise.all([
        getProducts({ inStockOnly: true }),
        getCategories({ activeOnly: true }),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch {
      setMessage('Unable to load products. Please try again.');
    } finally {
      setLoading(false);
    }
    // Clients list failing shouldn't block the product grid — checkout
    // simply falls back to "walk-in only" until it loads.
    try {
      setClients(await getClients());
    } catch {
      setClients([]);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Accessory (quantity-based) ya phone (unit-based) — dono handle karta hai.
  // Accessory ki quantity kabhi stockQty se zyada nahi jaati (frontend guard).
  function addToCart(product: Product, unit?: ProductUnit) {
    if (product.isSerialized) {
      if (!unit) return;
      const key = `unit-${unit.id}`;
      setCart((prev) => {
        if (prev.some((c) => c.key === key)) return prev; // ek hi phone dobara add nahi hoga
        // No suggested price set at add-time — leave the input blank instead
        // of prefilling "0"; the final price must be entered here before checkout.
        const defaultPrice = unit.salePrice != null ? toWholeRupees(unit.salePrice) : 0;
        return [
          ...prev,
          {
            key,
            product,
            unit,
            quantity: 1,
            price: defaultPrice,
            priceInput: unit.salePrice != null ? String(defaultPrice) : '',
            priceTouched: false,
          },
        ];
      });
      setLastAdded(`${product.name} (IMEI: ${unit.imei1})`);
      return;
    }

    const key = product.id;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) =>
          c.key === key
            ? { ...c, quantity: Math.min(c.quantity + 1, product.stockQty) }
            : c,
        );
      }
      // No suggested price set at add-time — leave the input blank instead
      // of prefilling "0"; the final price must be entered here before checkout.
      const defaultPrice = product.salePrice != null ? toWholeRupees(product.salePrice) : 0;
      return [
        ...prev,
        {
          key,
          product,
          quantity: 1,
          price: defaultPrice,
          priceInput: product.salePrice != null ? String(defaultPrice) : '',
          priceTouched: false,
        },
      ];
    });
    setLastAdded(product.name);
  }

  async function openUnitPicker(product: Product) {
    setPickerProduct(product);
    setPickerSelectedIds(new Set());
    setLoadingUnits(true);
    try {
      const units = await getProductUnits({
        productId: product.id,
        status: 'IN_STOCK',
      });
      setPickerUnits(units);
    } catch {
      setPickerUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  }

  function closeUnitPicker() {
    setPickerProduct(null);
    setPickerUnits([]);
    setPickerSelectedIds(new Set());
  }

  function handleProductClick(product: Product) {
    if (product.isSerialized) {
      if ((product.availableUnits ?? 0) === 0) return; // Out of stock — not sellable
      openUnitPicker(product);
    } else {
      if (product.stockQty === 0) return; // Out of stock — not sellable
      addToCart(product);
    }
  }

  // Toggle a device card's selection — clicking an unselected card selects
  // it (green), clicking an already-selected card deselects it. Every unit
  // is tracked independently by its own ProductUnit.id, so any number of
  // devices from the same grouped product can be highlighted at once.
  function toggleUnitSelection(unitId: string) {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  // Confirms the current multi-selection — re-checks each selected unit's
  // live status first (a device can be sold by another sale between opening
  // the picker and confirming) and only adds the ones still IN_STOCK.
  // Anything no longer available is skipped and reported via the same
  // "no longer available" message already used by the IMEI search flow.
  async function confirmPickerSelection() {
    if (!pickerProduct || pickerSelectedIds.size === 0) return;
    const product = pickerProduct;
    const selectedIds = Array.from(pickerSelectedIds);
    setConfirmingPicker(true);
    try {
      const freshUnits = await getProductUnits({ productId: product.id });
      const unavailable: { imei: string; status?: string }[] = [];
      for (const id of selectedIds) {
        const fresh = freshUnits.find((u) => u.id === id);
        const fallback = pickerUnits.find((u) => u.id === id);
        if (fresh && fresh.status === 'IN_STOCK') {
          addToCart(product, fresh);
        } else {
          unavailable.push({
            imei: fresh?.imei1 ?? fallback?.imei1 ?? 'unknown',
            status: fresh?.status,
          });
        }
      }
      if (unavailable.length > 0) {
        const sentences = unavailable.map(
          (u) =>
            `This device (IMEI: ${u.imei}) is no longer available${
              u.status ? ` (${u.status})` : ''
            }.`,
        );
        setMessage(`${sentences.join(' ')} Select another device.`);
        setLastAdded(null);
      } else {
        setMessage(null);
      }
    } catch {
      setMessage('Could not verify device availability. Please try again.');
    } finally {
      setConfirmingPicker(false);
      closeUnitPicker();
    }
  }

  // Ek hi search box — har keystroke par products live-filter hote hain (neeche),
  // aur Enter dabane par exact IMEI ya SKU/barcode match seedha cart mein add
  // ho jaata hai (purani "scan" flow ka logic, bas ab alag box nahi).
  async function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const code = search.trim();
    if (!code) return;

    setSearching(true);
    try {
      const unit = await searchByImei(code);
      if (unit) {
        if (unit.status !== 'IN_STOCK') {
          setMessage(
            `This device (IMEI: ${unit.imei1}) is no longer available (${unit.status}). Select another device.`,
          );
          setLastAdded(null);
        } else {
          const product = products.find((p) => p.id === unit.productId);
          if (product) {
            addToCart(product, unit);
            setMessage(null);
            setSearch('');
          } else {
            setMessage(
              'Device found but product data is missing. Refresh and try again.',
            );
          }
        }
        return;
      }

      const lower = code.toLowerCase();
      const found = products.find(
        (p) =>
          !p.isSerialized &&
          ((p.barcode && p.barcode.toLowerCase() === lower) ||
            p.sku.toLowerCase() === lower),
      );

      if (found) {
        if (found.stockQty === 0) {
          setMessage(`"${found.name}" is out of stock.`);
          setLastAdded(null);
        } else {
          addToCart(found);
          setMessage(null);
          setSearch('');
        }
      }
      // Koi exact IMEI/SKU match na mile to koi error nahi — niche wali grid
      // ka live substring filter pehle se hi relevant results dikha raha hai
    } finally {
      setSearching(false);
      searchRef.current?.focus();
    }
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.key !== key) return c;
          const next = c.quantity + delta;
          const capped = delta > 0 ? Math.min(next, c.product.stockQty) : next;
          return { ...c, quantity: capped };
        })
        .filter((c) => c.quantity > 0),
    );
  }

  function changePrice(key: string, rawValue: string) {
    // Sale price is a whole-number-only field — decimals are stripped at
    // the input level, never rounded after the fact.
    const value = stripDecimalPoint(rawValue);
    const num = parseFloat(value);
    setCart((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, priceInput: value, price: isNaN(num) ? 0 : num }
          : c,
      ),
    );
  }

  function markPriceTouched(key: string) {
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, priceTouched: true } : c)),
    );
  }

  function focusAndSelectPrice(key: string) {
    const el = priceInputRefs.current[key];
    if (!el) return;
    el.focus();
    el.select();
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  function clearCart() {
    setCart([]);
    setLastAdded(null);
    setSelectedClient(null);
  }

  function requestClearCart() {
    if (cart.length === 0) return;
    setShowClearConfirm(true);
  }

  function confirmClearCart() {
    clearCart();
    setShowClearConfirm(false);
    setShowMobileCart(false);
    searchRef.current?.focus();
  }

  // Original calculated total from item prices — preserved for audit/
  // reference regardless of any Grand Total override below.
  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  // Effective payable total used everywhere below (payment, receipt, sale
  // record) — the cashier-edited value when set, else the calculated subtotal.
  const total = totalOverride !== null ? totalOverride : subtotal;
  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const hasInvalidPrice = cart.some((c) => !(c.price > 0));

  function startEditTotal() {
    if (cart.length === 0 || checkingOut) return;
    setTotalInput(String(Math.round(total)));
    setEditingTotal(true);
  }

  function cancelEditTotal() {
    setEditingTotal(false);
    setTotalInput('');
  }

  // Guards against saving twice in a row (e.g. a fast double Enter/click) —
  // once applied, editingTotal flips off immediately so the Save action can't
  // fire again for the same input.
  function saveEditedTotal() {
    if (!editingTotal) return;
    const parsed = totalInput.trim() === '' ? NaN : Number(totalInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setTotalOverride(Math.round(parsed));
    setEditingTotal(false);
  }

  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter)
      return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.category?.name ?? '').toLowerCase().includes(q) ||
      (p.model?.name ?? '').toLowerCase().includes(q) ||
      (p.storage ?? '').toLowerCase().includes(q) ||
      (p.color ?? '').toLowerCase().includes(q)
    );
  });

  function openPaymentModal() {
    if (cart.length === 0) return;
    if (editingTotal) return; // finish or cancel the Grand Total edit first
    if (hasInvalidPrice) {
      setCart((prev) => prev.map((c) => ({ ...c, priceTouched: true })));
      return;
    }
    setPaymentMethod('CASH');
    setCashReceived(total.toFixed(2));
    setProvider(WALLET_PROVIDERS[0]);
    setBankName('');
    setPaymentError(null);
    setShowPayment(true);
  }

  function openClientPicker() {
    setClientSearch('');
    setAddingClient(false);
    setClientPickerError(null);
    setShowClientPicker(true);
  }

  function closeClientPicker() {
    setShowClientPicker(false);
    setAddingClient(false);
    setClientPickerError(null);
  }

  function chooseClient(client: ClientListItem) {
    setSelectedClient(client);
    closeClientPicker();
  }

  function continueAsWalkIn() {
    setSelectedClient(null);
    closeClientPicker();
  }

  function startAddClient() {
    setNewClientName('');
    setNewClientPhone(clientSearch.trim());
    setNewClientAddress('');
    setNewClientNote('');
    setClientPickerError(null);
    setAddingClient(true);
  }

  async function handleAddNewClient(e: FormEvent) {
    e.preventDefault();
    setSavingClient(true);
    setClientPickerError(null);
    try {
      const result = await createClient({
        fullName: newClientName.trim(),
        phone: newClientPhone.trim(),
        address: newClientAddress.trim() || undefined,
        note: newClientNote.trim() || undefined,
      });
      setSelectedClient({
        id: result.id,
        fullName: result.fullName,
        phone: result.phone,
        address: result.address,
        note: result.note,
        createdAt: result.createdAt,
        archivedAt: null,
        salesCount: 0,
        totalAmount: '0.00',
        totalPaid: '0.00',
        remainingBalance: '0.00',
        refundDue: '0.00',
        status: null,
        latestSale: null,
      });
      setClients((prev) =>
        prev.some((c) => c.id === result.id)
          ? prev
          : [
              {
                id: result.id,
                fullName: result.fullName,
                phone: result.phone,
                address: result.address,
                note: result.note,
                createdAt: result.createdAt,
                archivedAt: null,
                salesCount: 0,
                totalAmount: '0.00',
                totalPaid: '0.00',
                remainingBalance: '0.00',
                refundDue: '0.00',
                status: null,
                latestSale: null,
              },
              ...prev,
            ],
      );
      closeClientPicker();
    } catch {
      setClientPickerError('Could not add client. Please check the details and try again.');
    } finally {
      setSavingClient(false);
    }
  }

  const clientSearchResults = clients.filter((c) => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return true;
    return c.fullName.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  // Only meaningful when a client is selected — the amount actually being
  // paid right now, which may be less than the Grand Total (partial payment).
  // Walk-in sales are unaffected and still require the full total.
  const amountPayingNow = selectedClient ? Math.min(cashReceivedNum, total) : total;
  const remainingAfterSale = selectedClient ? Math.max(total - amountPayingNow, 0) : 0;

  async function handleConfirmPayment() {
    setPaymentError(null);

    // Walk-in sales keep the original rule: full payment required upfront,
    // and only CASH tracks a received amount at all. A client sale may
    // instead be paid partially, in which case "amount paying now" applies
    // regardless of payment method and must simply fall within [0, total].
    if (selectedClient) {
      if (cashReceived.trim() === '' || cashReceivedNum < 0) {
        setPaymentError('Enter the amount being paid now.');
        return;
      }
      if (cashReceivedNum > total) {
        setPaymentError('Amount paying now cannot exceed the Grand Total.');
        return;
      }
    } else if (paymentMethod === 'CASH' && (!cashReceived || cashReceivedNum < total)) {
      setPaymentError(
        'The full payment must be received before completing the sale.',
      );
      return;
    }

    setCheckingOut(true);
    try {
      const sale = await createSale({
        items: cart.map((c) =>
          c.unit
            ? {
                productId: c.product.id,
                quantity: 1,
                productUnitId: c.unit.id,
                price: c.price,
              }
            : {
                productId: c.product.id,
                quantity: c.quantity,
                price: c.price,
              },
        ),
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? cashReceivedNum : undefined,
        provider: paymentMethod === 'ONLINE_WALLET' ? provider : undefined,
        bankName: paymentMethod === 'BANK_TRANSFER' ? bankName : undefined,
        // Only sent when the cashier actually edited the Grand Total —
        // the backend keeps the item-price sum as subtotalAmount either way.
        finalTotal: totalOverride !== null ? total : undefined,
        clientId: selectedClient?.id,
        amountPaid: selectedClient ? amountPayingNow : undefined,
      });
      setReceipt(sale);
      setReceiptClientInfo(
        selectedClient
          ? {
              fullName: selectedClient.fullName,
              phone: selectedClient.phone,
              amountPaid: amountPayingNow,
              remainingBalance: remainingAfterSale,
            }
          : null,
      );
      setEditingReceipt(false);
      setEditMessage(null);
      clearCart();
      setShowPayment(false);
      setShowMobileCart(false);
      await loadData();
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : 'The sale could not be completed. Review the payment details and try again.',
      );
    } finally {
      setCheckingOut(false);
    }
  }

  function closeReceiptModal() {
    setClosingReceipt(true);
    setTimeout(() => {
      setReceipt(null);
      setReceiptClientInfo(null);
      setEditingReceipt(false);
      setEditMessage(null);
      setClosingReceipt(false);
      // Cashier ko wapas product search par le jao — agla sale turant shuru ho sake
      searchRef.current?.focus();
    }, 180);
  }

  function handlePrintReceipt() {
    if (printingReceipt) return;
    setPrintingReceipt(true);

    function handleAfterPrint() {
      window.removeEventListener('afterprint', handleAfterPrint);
      setPrintingReceipt(false);
      closeReceiptModal();
    }

    window.addEventListener('afterprint', handleAfterPrint);
    window.print();
  }

  function removeReceiptItem(itemId: string) {
    if (!receipt) return;
    const newItems = receipt.items.filter((i) => i.id !== itemId);
    const newTotal = newItems.reduce(
      (sum, i) => sum + parseFloat(i.lineTotal),
      0,
    );
    setReceipt({
      ...receipt,
      items: newItems,
      totalAmount: newTotal.toFixed(2),
    });
  }

  function changeReceiptQty(itemId: string, delta: number) {
    if (!receipt) return;
    if (delta > 0) {
      const item = receipt.items.find((i) => i.id === itemId);
      if (item) {
        const product = products.find((p) => p.id === item.productId);
        const available = product ? product.stockQty : 0;
        if (item.quantity >= available) {
          setEditMessage(
            `Only ${available} in stock for "${item.productName}".`,
          );
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
        return {
          ...i,
          quantity: newQty,
          lineTotal: (unit * newQty).toFixed(2),
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
    const newTotal = newItems.reduce(
      (sum, i) => sum + parseFloat(i.lineTotal),
      0,
    );
    setReceipt({
      ...receipt,
      items: newItems,
      totalAmount: newTotal.toFixed(2),
    });
  }

  function addReceiptItem(product: Product) {
    if (!receipt) return;
    if (product.stockQty === 0) {
      setEditMessage(`"${product.name}" is out of stock.`);
      return;
    }
    const existing = receipt.items.find((i) => i.productId === product.id);
    if (existing && existing.quantity >= product.stockQty) {
      setEditMessage(
        `Only ${product.stockQty} in stock for "${product.name}".`,
      );
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
              lineTotal: (parseFloat(i.unitPrice) * (i.quantity + 1)).toFixed(
                2,
              ),
            }
          : i,
      );
    } else {
      newItems = [
        ...receipt.items,
        {
          id: `temp-${product.id}-${crypto.randomUUID()}`,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.salePrice ?? '0',
          lineTotal: product.salePrice ?? '0',
          // Ye local receipt-edit item hai (kabhi API ko nahi jaata) — costPrice
          // sirf SaleItem type ko satisfy karne ke liye, display-only hai
          costPrice: product.costPrice ?? '0',
        },
      ];
    }
    const newTotal = newItems.reduce(
      (sum, i) => sum + parseFloat(i.lineTotal),
      0,
    );
    setReceipt({
      ...receipt,
      items: newItems,
      totalAmount: newTotal.toFixed(2),
    });
  }

  // Escape-to-close + focus trap for the receipt/edit dialog
  useEffect(() => {
    if (!receipt) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    receiptCloseButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeReceiptModal();
        return;
      }
      if (e.key === 'Tab' && receiptModalRef.current) {
        const focusable = receiptModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
     
  }, [receipt]);

  const paymentMethods: {
    key: PaymentMethod;
    label: string;
    icon: typeof WalletIcon;
  }[] = [
    { key: 'CASH', label: 'Cash', icon: WalletIcon },
    { key: 'CARD', label: 'Card', icon: CreditCardIcon },
    { key: 'ONLINE_WALLET', label: 'Mobile Wallet', icon: SmartphoneIcon },
    { key: 'BANK_TRANSFER', label: 'Bank Transfer', icon: LandmarkIcon },
  ];

  // Cart body reused for both the desktop sticky panel and the mobile drawer
  function renderCartBody() {
    return (
      <>
        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingCartIcon}
            title="Your cart is empty"
            description="Search and select a product to begin a new sale."
          />
        ) : (
          <>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto px-4 py-3 lg:max-h-[38vh]">
              {cart.map((c) => (
                <div
                  key={c.key}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {c.product.name}
                      </div>
                      {c.unit ? (
                        <>
                          <div className="truncate font-mono text-xs text-slate-500">
                            IMEI: {c.unit.imei1}
                          </div>
                          {c.unit.notes && (
                            <div className="truncate text-xs italic text-amber-600">
                              Note: {c.unit.notes}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="truncate text-xs text-slate-500">
                          {c.price > 0
                            ? `${formatCurrency(c.price)} each`
                            : 'Price not set'}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(c.key)}
                      aria-label={`Remove ${c.product.name}`}
                      title="Remove"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {c.unit ? (
                    // Phone — quantity fixed 1, price editable (negotiation)
                    <div>
                      {(isAdmin || isSalesman) && c.unit.costPrice != null && (
                        <div className="mb-1.5 text-xs text-slate-500">
                          Cost Price:{' '}
                          <span className="font-semibold text-slate-600">
                            {formatCurrency(c.unit.costPrice)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => focusAndSelectPrice(c.key)}
                          className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                          Edit Price
                        </button>
                        <input
                          ref={(el) => {
                            priceInputRefs.current[c.key] = el;
                          }}
                          type="number"
                          step="1"
                          value={c.priceInput}
                          onChange={(e) => changePrice(c.key, e.target.value)}
                          onKeyDown={blockDecimalKeyDown}
                          onPaste={blockDecimalPaste}
                          onBlur={() => markPriceTouched(c.key)}
                          placeholder="Enter selling price"
                          aria-label={`Price for ${c.product.name}`}
                          className={`w-36 shrink-0 rounded-xl border bg-white px-3 py-2.5 text-right text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-soft ${
                            c.priceTouched && !c.priceInput.trim()
                              ? 'border-red-400 focus:border-red-500'
                              : 'border-slate-200 focus:border-primary'
                          }`}
                        />
                      </div>
                      {c.priceTouched && !c.priceInput.trim() && (
                        <p className="mt-1 text-right text-[11px] text-red-600">
                          Selling price is required.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(isAdmin || isSalesman) && c.product.costPrice != null && (
                        <div className="text-xs text-slate-500">
                          Cost Price:{' '}
                          <span className="font-semibold text-slate-600">
                            {formatCurrency(c.product.costPrice)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white p-1 shadow-sm">
                          <button
                            onClick={() => changeQty(c.key, -1)}
                            aria-label={`Decrease quantity of ${c.product.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100"
                          >
                            <MinusIcon className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-slate-900">
                            {c.quantity}
                          </span>
                          <button
                            onClick={() => changeQty(c.key, 1)}
                            disabled={c.quantity >= c.product.stockQty}
                            aria-label={`Increase quantity of ${c.product.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => focusAndSelectPrice(c.key)}
                              className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-primary"
                            >
                              <PencilIcon className="h-4 w-4" />
                              Edit Price
                            </button>
                            <input
                              ref={(el) => {
                                priceInputRefs.current[c.key] = el;
                              }}
                              type="number"
                              step="1"
                              value={c.priceInput}
                              onChange={(e) =>
                                changePrice(c.key, e.target.value)
                              }
                              onKeyDown={blockDecimalKeyDown}
                              onPaste={blockDecimalPaste}
                              onBlur={() => markPriceTouched(c.key)}
                              placeholder="Enter selling price"
                              aria-label={`Price for ${c.product.name}`}
                              className={`w-32 rounded-xl border bg-white px-3 py-2.5 text-right text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-soft ${
                                c.priceTouched && !c.priceInput.trim()
                                  ? 'border-red-400 focus:border-red-500'
                                  : 'border-slate-200 focus:border-primary'
                              }`}
                            />
                          </div>
                          {c.priceTouched && !c.priceInput.trim() && (
                            <p className="text-[11px] text-red-600">
                              Selling price is required.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <PriceDisplay value={c.price * c.quantity} size="md" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 p-4">
              <div className="mb-3 space-y-1.5">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Items</span>
                  <span>{formatNumber(itemCount)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalOverride !== null && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Adjustment</span>
                    <span
                      className={
                        subtotal - total >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }
                    >
                      {subtotal - total >= 0 ? '-' : '+'}
                      {formatCurrency(Math.abs(subtotal - total))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                  <span className="text-base font-semibold text-slate-900">
                    Grand Total
                  </span>
                  {editingTotal ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={totalInput}
                        onChange={(e) =>
                          setTotalInput(e.target.value.replace(/[^0-9]/g, ''))
                        }
                        onKeyDown={(e) => {
                          blockDecimalKeyDown(e);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEditedTotal();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEditTotal();
                          }
                        }}
                        onPaste={blockDecimalPaste}
                        aria-label="Edit grand total"
                        className="w-24 rounded-lg border border-primary bg-white px-2 py-1 text-right text-base font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-soft"
                      />
                      <button
                        type="button"
                        onClick={saveEditedTotal}
                        disabled={totalInput.trim() === ''}
                        aria-label="Save grand total"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckCircleIcon className="h-4.5 w-4.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditTotal}
                        aria-label="Cancel editing grand total"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <XIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <PriceDisplay value={total} size="xl" />
                      {SHOW_GRAND_TOTAL_EDIT && (
                        <button
                          type="button"
                          onClick={startEditTotal}
                          aria-label="Edit grand total"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-primary"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {hasInvalidPrice && (
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
                  Every item&apos;s price must be greater than zero.
                </div>
              )}
              <button
                onClick={openPaymentModal}
                disabled={
                  checkingOut ||
                  cart.length === 0 ||
                  hasInvalidPrice ||
                  editingTotal
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="POS Terminal"
          subtitle="Search, select, and complete sales."
          actions={
            cart.length > 0 ? (
              <button
                onClick={requestClearCart}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2Icon className="h-4 w-4" />
                Clear Cart
              </button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Product browsing area (~65-70%) */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              {/* Search */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setMessage(null);
                  }}
                  placeholder="Search by category, model, storage, color, SKU, or IMEI..."
                  autoFocus
                  disabled={searching}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-11 pr-11 text-base text-slate-900 transition focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-soft"
                />
                {searching ? (
                  <Loader2Icon className="pointer-events-none absolute right-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 animate-spin text-slate-400" />
                ) : (
                  search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setMessage(null);
                        searchRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </form>

              {lastAdded && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                  <CheckCircleIcon className="h-4.5 w-4.5 shrink-0" />
                  Added: {lastAdded}
                </div>
              )}
              {message && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                  <AlertTriangleIcon className="h-4.5 w-4.5 shrink-0" />
                  {message}
                </div>
              )}

              {/* Category navigation — dynamically loaded, horizontally scrollable */}
              {categories.length > 0 && (
                <div className="scrollbar-thin mt-4 flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setCategoryFilter('ALL')}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      categoryFilter === 'ALL'
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryFilter(c.id)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                        categoryFilter === c.id
                          ? 'bg-primary text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product grid */}
            <div className="mt-4">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} className="h-32" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <EmptyState
                    icon={InboxIcon}
                    title="No products found"
                    description="Try a different product name, model, SKU, or IMEI."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {filteredProducts.map((p) => {
                    // Serialized (phone) availability comes from IN_STOCK unit
                    // count, not Product.stockQty — accessories use stockQty
                    // directly. Same three visual states apply to both.
                    const availableCount = p.isSerialized
                      ? (p.availableUnits ?? 0)
                      : p.stockQty;
                    const out = availableCount === 0;
                    const low = !out && availableCount <= p.reorderLevel;
                    const inCartQty =
                      cart.find((c) => c.key === p.id)?.quantity ?? 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleProductClick(p)}
                        disabled={out}
                        className="group relative flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none"
                      >
                        {inCartQty > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-sm">
                            {inCartQty}
                          </span>
                        )}
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {p.name}
                        </div>
                        {p.isSerialized && (p.category?.name || p.storage) && (
                          <div className="truncate text-[11px] text-slate-400">
                            {[p.category?.name, p.model?.name, p.storage, p.color]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                        {!p.isSerialized && p.category?.name && (
                          <div className="truncate text-[11px] text-slate-400">
                            {p.category.name}
                          </div>
                        )}
                        <div className="mt-auto pt-1.5">
                          {p.salePrice != null ? (
                            <PriceDisplay
                              value={p.salePrice}
                              size="sm"
                              tone="default"
                              className="text-primary"
                            />
                          ) : (
                            <span className="text-sm text-slate-400">Set price at sale</span>
                          )}
                          <div className="mt-1.5 flex items-center gap-1">
                            {out ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                OUT OF STOCK
                              </span>
                            ) : low ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                Low · {formatNumber(availableCount)}
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                {formatNumber(availableCount)} Available
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart panel — desktop only, sticky (~30-35%) */}
          <div className="hidden lg:col-span-4 lg:block">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShoppingCartIcon className="h-4.5 w-4.5 text-slate-400" />
                  Current Sale
                </h2>
                <div className="flex items-center gap-2">
                  {itemCount > 0 && (
                    <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {itemCount} item{itemCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {cart.length > 0 && (
                    <button
                      onClick={requestClearCart}
                      aria-label="Clear cart"
                      title="Clear cart"
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {renderCartBody()}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/tablet sticky cart bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] lg:hidden">
          <button
            onClick={() => setShowMobileCart(true)}
            className="flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 text-white shadow-sm transition hover:bg-primary-hover"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCartIcon className="h-4.5 w-4.5" />
              {itemCount} item{itemCount > 1 ? 's' : ''}
            </span>
            <span className="text-base font-bold">{formatCurrency(total)}</span>
          </button>
        </div>
      )}

      {/* Mobile/tablet cart drawer */}
      {showMobileCart && (
        <Drawer title="Current Sale" onClose={() => setShowMobileCart(false)}>
          {renderCartBody()}
        </Drawer>
      )}

      {/* Clear cart confirmation */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear Cart?"
          description="This will remove all items from the current sale."
          confirmLabel="Clear Cart"
          variant="danger"
          onConfirm={confirmClearCart}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {/* Device selection modal (serialized products) */}
      {pickerProduct && (
        <Modal
          title={`Select a device — ${pickerProduct.name}`}
          onClose={closeUnitPicker}
          size="xl"
          panelClassName="lg:!max-w-5xl xl:!max-w-6xl sm:!min-h-[70vh]"
          footer={
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                {pickerSelectedIds.size > 0
                  ? `${pickerSelectedIds.size} device${pickerSelectedIds.size > 1 ? 's' : ''} selected`
                  : 'Select one or more devices'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeUnitPicker}
                  disabled={confirmingPicker}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPickerSelection}
                  disabled={pickerSelectedIds.size === 0 || confirmingPicker}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmingPicker && <Loader2Icon className="h-4 w-4 animate-spin" />}
                  {confirmingPicker
                    ? 'Adding...'
                    : `Add ${pickerSelectedIds.size > 0 ? pickerSelectedIds.size : ''} to Cart`}
                </button>
              </div>
            </div>
          }
        >
          <p className="-mt-3 mb-5 text-sm text-slate-500">
            {[pickerProduct.category?.name, pickerProduct.storage]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {loadingUnits ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} className="h-24" />
              ))}
            </div>
          ) : pickerUnits.length === 0 ? (
            <EmptyState
              icon={SmartphoneIcon}
              title="No devices available"
              description="No units are currently in stock for this model."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pickerUnits.map((u) => {
                const selected = pickerSelectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUnitSelection(u.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-primary/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="font-mono text-sm text-slate-700">
                        IMEI: {u.imei1}
                      </div>
                      <div className="mt-1.5 truncate text-sm text-slate-500">
                        {[
                          u.color,
                          CONDITION_LABELS[u.deviceCondition],
                          u.conditionGrade ? `${u.conditionGrade}/10` : null,
                          u.batteryHealth != null
                            ? `${u.batteryHealth}% battery`
                            : null,
                          u.ptaStatus,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {u.notes && (
                        <div className="mt-1 truncate text-xs italic text-amber-600">
                          Note: {u.notes}
                        </div>
                      )}
                    </div>
                    {u.salePrice != null ? (
                      <PriceDisplay value={u.salePrice} size="lg" className="shrink-0" />
                    ) : (
                      <span className="shrink-0 text-sm text-slate-400">Set at sale</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* Checkout modal */}
      {showPayment && (
        <Modal title="Checkout" onClose={() => setShowPayment(false)} size="xl">
          {/* Client — walk-in by default; select existing, add new, or search by name/phone */}
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                <UserIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {selectedClient ? selectedClient.fullName : 'Walk-in Customer'}
                </div>
                {selectedClient && (
                  <div className="truncate text-xs text-slate-500">{selectedClient.phone}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={openClientPicker}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {selectedClient ? 'Change' : 'Select Client'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Sale summary */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Sale Summary
              </h3>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                {cart.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate pr-2 text-slate-600">
                      {c.product.name}
                      {!c.unit && ` × ${c.quantity}`}
                    </span>
                    <span className="shrink-0 font-medium text-slate-900">
                      {formatCurrency(c.price * c.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              {totalOverride !== null && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Adjustment</span>
                    <span
                      className={
                        subtotal - total >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }
                    >
                      {subtotal - total >= 0 ? '-' : '+'}
                      {formatCurrency(Math.abs(subtotal - total))}
                    </span>
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                <span className="text-sm font-medium text-slate-300">
                  Grand Total
                </span>
                <span className="text-xl font-bold text-white">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Payment method + amount */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Payment Method
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setPaymentMethod(m.key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3.5 transition ${
                        paymentMethod === m.key
                          ? 'border-primary bg-primary-soft shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${paymentMethod === m.key ? 'text-primary' : 'text-slate-400'}`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          paymentMethod === m.key
                            ? 'text-primary'
                            : 'text-slate-600'
                        }`}
                      >
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {paymentMethod === 'ONLINE_WALLET' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Wallet Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                    >
                      {WALLET_PROVIDERS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {paymentMethod === 'BANK_TRANSFER' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Bank Name
                    </label>
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="HBL"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                    />
                  </div>
                )}

                {selectedClient ? (
                  // Client sale — a clear payment summary: Total Bill,
                  // Initial Payment (editable, may be less than the Grand
                  // Total), Remaining Balance, Payment Status, and Payment
                  // Method — e.g. "Total Bill: Rs 120,000 / Initial Payment:
                  // Rs 50,000 / Remaining Balance: Rs 70,000 / PARTIAL / Cash".
                  <div className="rounded-xl bg-primary-soft p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Total Bill</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
                    </div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Initial Payment
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={total}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-lg font-bold text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                    />
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Remaining Balance</span>
                      <span
                        className={`font-semibold ${remainingAfterSale > 0 ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {formatCurrency(remainingAfterSale)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Payment Status</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          amountPayingNow >= total
                            ? 'bg-emerald-100 text-emerald-700'
                            : amountPayingNow > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {amountPayingNow >= total ? 'PAID' : amountPayingNow > 0 ? 'PARTIAL' : 'UNPAID'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                      <span className="text-slate-600">Payment Method</span>
                      <span className="font-medium text-slate-900">
                        {paymentMethod === 'CASH' && 'Cash'}
                        {paymentMethod === 'CARD' && 'Card'}
                        {paymentMethod === 'ONLINE_WALLET' && (provider || 'Wallet')}
                        {paymentMethod === 'BANK_TRANSFER' &&
                          (bankName ? `Bank (${bankName})` : 'Bank Transfer')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-primary-soft p-4 text-center">
                    <p className="text-sm text-slate-600">
                      {paymentMethod === 'CASH' ? 'Amount Received' : 'Amount to charge'}
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(total)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {paymentError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {paymentError}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setShowPayment(false)}
              disabled={checkingOut}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={checkingOut}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkingOut && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {checkingOut ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </Modal>
      )}

      {/* Client picker — search existing clients by name/phone, add a new
          one without leaving the POS, or continue as walk-in. */}
      {showClientPicker && (
        <Modal
          title={addingClient ? 'Add New Client' : 'Select Client'}
          onClose={closeClientPicker}
          size="md"
        >
          {addingClient ? (
            <form onSubmit={handleAddNewClient} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Full Name</label>
                <input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                  placeholder="e.g. Ahmed Khan"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Phone Number</label>
                <input
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  required
                  placeholder="03001234567"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Address <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={newClientNote}
                  onChange={(e) => setNewClientNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                />
              </div>

              {clientPickerError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  {clientPickerError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddingClient(false)}
                  disabled={savingClient}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingClient && <Loader2Icon className="h-4 w-4 animate-spin" />}
                  {savingClient ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="relative mb-3">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search by name or phone number..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                />
              </div>

              <button
                type="button"
                onClick={continueAsWalkIn}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Continue as Walk-in Customer
              </button>

              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {clientSearchResults.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">
                    No clients match &quot;{clientSearch}&quot;.
                  </div>
                ) : (
                  clientSearchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => chooseClient(c)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary/40 hover:bg-primary-soft/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{c.fullName}</div>
                        <div className="truncate text-xs text-slate-500">{c.phone}</div>
                      </div>
                      {c.status && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            c.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.status === 'PARTIAL'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={startAddClient}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"
              >
                <PlusIcon className="h-4 w-4" />
                Add New Client
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Receipt Modal — bespoke (not the shared Modal) because of the print-specific
          CSS overrides (print:*) that only this screen needs. */}
      {receipt && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm print:bg-white print:p-0 print:backdrop-blur-none ${
            closingReceipt
              ? 'animate-modal-overlay-out'
              : 'animate-modal-overlay-in'
          }`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeReceiptModal();
          }}
        >
          <div
            ref={receiptModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            aria-describedby="receipt-modal-description"
            className={`flex w-[92vw] max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-full sm:max-w-2xl print:max-h-none print:w-full print:max-w-full print:overflow-visible print:rounded-none print:border-none print:shadow-none ${
              closingReceipt
                ? 'animate-modal-panel-out'
                : 'animate-modal-panel-in'
            }`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 print:hidden">
              <div>
                <h2
                  id="receipt-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {editingReceipt ? 'Edit Sale' : 'Sale Completed'}
                </h2>
                <p
                  id="receipt-modal-description"
                  className="mt-0.5 text-xs text-slate-500"
                >
                  Bill #{receipt.dailyInvoiceNumber} ·{' '}
                  {new Date(receipt.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                ref={receiptCloseButtonRef}
                onClick={closeReceiptModal}
                aria-label="Close receipt"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <XIcon className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 print:overflow-visible print:p-0">
              {!editingReceipt && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 print:hidden">
                  <CheckCircleIcon className="h-5 w-5 shrink-0" />
                  Sale completed successfully — Invoice #
                  {receipt.dailyInvoiceNumber}
                </div>
              )}
              <div
                id="receipt-print"
                className="mx-auto font-mono text-slate-900"
                style={{ width: '280px' }}
              >
                <div className="mb-3 text-center">
                  <h2 className="text-base font-bold tracking-wide">
                    MOBILE SHOP
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    Sales Receipt
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
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1"
                    >
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
                        <span className="w-1/4 text-center">
                          {item.quantity}
                        </span>
                      )}
                      <span className="w-1/4 text-right">
                        {formatCurrency(item.lineTotal)}
                      </span>
                      {editingReceipt && (
                        <button
                          onClick={() => removeReceiptItem(item.id)}
                          className="ml-1 text-red-600 print:hidden"
                          aria-label="Remove item"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-400 pt-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>TOTAL</span>
                    <span>{formatCurrency(receipt.totalAmount)}</span>
                  </div>
                </div>

                <div className="mt-2 border-t border-dashed border-slate-400 pt-2 text-[10px] text-slate-600">
                  {receiptClientInfo && (
                    <div className="flex justify-between">
                      <span>Customer</span>
                      <span className="font-semibold">
                        {receiptClientInfo.fullName} ({receiptClientInfo.phone})
                      </span>
                    </div>
                  )}
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
                    <div className="flex justify-between">
                      <span>Cash Received</span>
                      <span>{formatCurrency(receipt.cashReceived)}</span>
                    </div>
                  )}
                  {receiptClientInfo && (
                    <>
                      <div className="flex justify-between">
                        <span>Initial Payment</span>
                        <span>{formatCurrency(receiptClientInfo.amountPaid)}</span>
                      </div>
                      {receiptClientInfo.remainingBalance > 0 && (
                        <div className="flex justify-between font-semibold text-red-600">
                          <span>Remaining Balance</span>
                          <span>{formatCurrency(receiptClientInfo.remainingBalance)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Payment Status</span>
                        <span className="font-semibold">
                          {receiptClientInfo.remainingBalance <= 0
                            ? 'PAID'
                            : receiptClientInfo.amountPaid > 0
                              ? 'PARTIAL'
                              : 'UNPAID'}
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
                <div className="mt-5 border-t border-slate-200 pt-4 print:hidden">
                  {editMessage && (
                    <div
                      role="alert"
                      className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                    >
                      {editMessage}
                    </div>
                  )}
                  <p className="mb-2 text-xs font-semibold text-slate-600">
                    Add product (accessories only)
                  </p>
                  <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    {products
                      .filter((p) => !p.isSerialized)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addReceiptItem(p)}
                          disabled={p.stockQty === 0}
                          className="rounded-lg border border-slate-200 p-2 text-left text-xs transition hover:border-primary/50 disabled:opacity-50"
                        >
                          <div className="font-medium text-slate-900">
                            {p.name}
                          </div>
                          <div className="text-slate-500">
                            {formatCurrency(p.salePrice)} ·{' '}
                            {formatNumber(p.stockQty)}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-6 py-4 print:hidden">
              <button
                onClick={handlePrintReceipt}
                disabled={printingReceipt}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PrinterIcon className="h-4 w-4" />
                {printingReceipt ? 'Printing...' : 'Print Receipt'}
              </button>
              <button
                onClick={() => {
                  setEditingReceipt((v) => !v);
                  setEditMessage(null);
                }}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  editingReceipt
                    ? 'bg-primary text-white hover:bg-primary-hover'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {editingReceipt ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={closeReceiptModal}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
