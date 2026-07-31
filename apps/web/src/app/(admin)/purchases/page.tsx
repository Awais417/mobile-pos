'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getPurchases,
  getPurchase,
  createPurchase,
  cancelPurchase,
  addPurchasePayment,
  PurchaseListItem,
  PurchaseDetail,
  PurchaseItemInput,
} from '@/lib/purchases';
import { getVendors, getVendorOutlets, VendorListItem, Outlet } from '@/lib/vendors';
import { PaymentMethod } from '@/lib/sales';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, SkeletonCard } from '@/components/ui/Skeletons';
import { StatusBadge, BadgeTone } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Drawer } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { DetailSection, DetailItem } from '@/components/ui/DetailList';
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  ghostButtonClass,
} from '@/components/ui/styles';
import {
  PackageIcon,
  WalletIcon,
  AlertTriangleIcon,
  PlusIcon,
  EyeIcon,
  Loader2Icon,
  InboxIcon,
  Trash2Icon,
  ClockIcon,
} from '@/components/icons';

const WALLET_PROVIDERS = ['JazzCash', 'Easypaisa', 'Sadapay', 'NayaPay', 'Other'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusTone(status: string): BadgeTone {
  if (status === 'ACTIVE') return 'success';
  return 'neutral';
}

function paymentStatusTone(status: string | null): BadgeTone {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIAL') return 'warning';
  if (status === 'UNPAID') return 'danger';
  return 'neutral';
}

interface DraftLine {
  key: string;
  itemName: string;
  description: string;
  quantity: string;
  unitCost: string;
}

export default function PurchasesPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const canManage = user?.role === 'ADMIN' || user?.role === 'BRANCH_MANAGER';

  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newVendorId, setNewVendorId] = useState('');
  const [newOutletId, setNewOutletId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Payment summary — Initial/Advance Payment section on the New Purchase form.
  const [initialAmount, setInitialAmount] = useState('0');
  const [initialMethod, setInitialMethod] = useState<PaymentMethod>('CASH');
  const [initialProvider, setInitialProvider] = useState(WALLET_PROVIDERS[0]);
  const [initialBank, setInitialBank] = useState('');
  const [initialDate, setInitialDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [initialNote, setInitialNote] = useState('');
  const [initialDeduct, setInitialDeduct] = useState(false);

  const [savingPurchase, setSavingPurchase] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<PurchaseDetail | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [payTarget, setPayTarget] = useState<PurchaseDetail | null>(null);
  const [payAmount, setPayAmount] = useState('0');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payProvider, setPayProvider] = useState(WALLET_PROVIDERS[0]);
  const [payBank, setPayBank] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');
  const [payDeduct, setPayDeduct] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function loadPurchases() {
    try {
      const data = await getPurchases({ status: statusFilter === 'ALL' ? undefined : statusFilter });
      setPurchases(data);
    } catch {
      setError('Could not load purchases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    getVendors({ includeArchived: false }).then((all) => setVendors(all.filter((v) => v.isActive)));
    getVendorOutlets().then(setOutlets).catch(() => setOutlets([]));
  }, []);

  const summary = useMemo(() => {
    const totalBills = purchases.length;
    const totalPayable = purchases.reduce((s, p) => s + Number(p.remainingAmount), 0);
    const activeCount = purchases.filter((p) => p.status === 'ACTIVE').length;
    const overdueCount = purchases.filter(
      (p) => p.status === 'ACTIVE' && p.dueDate && new Date(p.dueDate) < new Date() && Number(p.remainingAmount) > 0,
    ).length;
    return { totalBills, totalPayable, activeCount, overdueCount };
  }, [purchases]);

  function newLine(): DraftLine {
    return { key: Math.random().toString(36).slice(2), itemName: '', description: '', quantity: '1', unitCost: '' };
  }

  function openNewModal() {
    setNewVendorId('');
    setNewOutletId('');
    setNewDueDate('');
    setNewNotes('');
    setLines([newLine()]);
    setInitialAmount('0');
    setInitialMethod('CASH');
    setInitialProvider(WALLET_PROVIDERS[0]);
    setInitialBank('');
    setInitialDate(new Date().toISOString().slice(0, 10));
    setInitialNote('');
    setInitialDeduct(false);
    setFormError(null);
    setShowNewModal(true);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const purchaseTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.unitCost) || 0) * (parseInt(l.quantity, 10) || 0), 0),
    [lines],
  );
  const initialAmountNum = parseFloat(initialAmount) || 0;
  const initialRemaining = Math.max(purchaseTotal - initialAmountNum, 0);

  function buildItemsPayload(): PurchaseItemInput[] | null {
    const items: PurchaseItemInput[] = [];
    for (const l of lines) {
      if (!l.itemName.trim()) continue;
      const quantity = parseInt(l.quantity, 10) || 0;
      const unitCost = parseFloat(l.unitCost) || 0;
      if (quantity <= 0 || unitCost < 0) return null;
      items.push({
        itemName: l.itemName.trim(),
        description: l.description.trim() || undefined,
        quantity,
        unitCost,
      });
    }
    return items.length > 0 ? items : null;
  }

  async function handleSavePurchase() {
    setFormError(null);
    if (!newVendorId) {
      setFormError('Select a vendor.');
      return;
    }
    const items = buildItemsPayload();
    if (!items) {
      setFormError('Add at least one item with a valid quantity (greater than 0) and unit cost (0 or more).');
      return;
    }
    if (initialAmountNum < 0) {
      setFormError('Initial payment cannot be negative.');
      return;
    }
    if (initialAmountNum > purchaseTotal) {
      setFormError('Initial payment cannot exceed the purchase total.');
      return;
    }

    setSavingPurchase(true);
    try {
      const created = await createPurchase({
        vendorId: newVendorId,
        outletId: newOutletId || undefined,
        dueDate: newDueDate || undefined,
        notes: newNotes.trim() || undefined,
        items,
        initialPayment:
          initialAmountNum > 0
            ? {
                amount: initialAmountNum,
                method: initialMethod,
                provider: initialMethod === 'ONLINE_WALLET' ? initialProvider : undefined,
                bankName: initialMethod === 'BANK_TRANSFER' ? initialBank : undefined,
                note: initialNote.trim() || undefined,
                paidAt: initialDate || undefined,
                deductFromDashboardCash: initialDeduct,
              }
            : undefined,
      });
      showToast('success', `Purchase #${created.purchaseNumber} recorded successfully.`);
      setShowNewModal(false);
      await loadPurchases();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this purchase.');
    } finally {
      setSavingPurchase(false);
    }
  }

  async function openDetails(id: string) {
    setDetailId(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const data = await getPurchase(id);
      setDetail(data);
    } catch {
      showToast('error', 'Could not load purchase details.');
      setDetailId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetails() {
    setDetailId(null);
    setDetail(null);
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelPurchase(cancelTarget.id, cancelReason.trim() || undefined);
      showToast('success', 'Purchase cancelled.');
      setCancelTarget(null);
      await loadPurchases();
      if (detailId === cancelTarget.id) await openDetails(cancelTarget.id);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not cancel this purchase.');
    } finally {
      setCancelling(false);
    }
  }

  function openPayModal(p: PurchaseDetail) {
    setPayTarget(p);
    setPayAmount(String(Math.round(Number(p.remainingAmount))));
    setPayMethod('CASH');
    setPayProvider(WALLET_PROVIDERS[0]);
    setPayBank('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote('');
    setPayDeduct(false);
    setPayError(null);
  }

  async function handleConfirmPay() {
    if (!payTarget) return;
    const amount = parseFloat(payAmount) || 0;
    const remaining = Number(payTarget.remainingAmount);
    if (amount <= 0) {
      setPayError('Enter an amount greater than zero.');
      return;
    }
    if (amount > remaining) {
      setPayError(`Amount cannot exceed the remaining balance of ${formatCurrency(remaining)}.`);
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      await addPurchasePayment(payTarget.id, {
        amount,
        method: payMethod,
        provider: payMethod === 'ONLINE_WALLET' ? payProvider : undefined,
        bankName: payMethod === 'BANK_TRANSFER' ? payBank : undefined,
        note: payNote.trim() || undefined,
        paidAt: payDate || undefined,
        deductFromDashboardCash: payDeduct,
      });
      showToast('success', 'Payment recorded successfully.');
      setPayTarget(null);
      await loadPurchases();
      if (detailId === payTarget.id) await openDetails(payTarget.id);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not record payment.');
    } finally {
      setPaying(false);
    }
  }

  const summaryCards = [
    { label: 'Total Bills', value: formatNumber(summary.totalBills), icon: PackageIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Bills', value: formatNumber(summary.activeCount), icon: ClockIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Payable', value: formatCurrency(summary.totalPayable), icon: WalletIcon, color: 'bg-red-50 text-red-600' },
    { label: 'Overdue Bills', value: formatNumber(summary.overdueCount), icon: AlertTriangleIcon, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Purchase Bills"
          subtitle="Record what you purchased from vendors and track payments."
          actions={
            canManage ? (
              <button type="button" onClick={openNewModal} className={primaryButtonClass}>
                <PlusIcon className="h-4 w-4" />
                New Purchase
              </button>
            ) : undefined
          }
        />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)
            : summaryCards.map((c) => <SummaryCard key={c.label} {...c} />)}
        </div>

        <FilterToolbar hasActiveFilters={statusFilter !== 'ALL'} onClear={() => setStatusFilter('ALL')}>
          {['ALL', 'ACTIVE', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === s ? 'bg-primary text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'ALL' ? 'All Statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </FilterToolbar>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : purchases.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No purchases yet"
              description="Create your first vendor purchase to start tracking payables."
              action={
                canManage ? (
                  <button type="button" onClick={openNewModal} className={primaryButtonClass}>
                    <PlusIcon className="h-4 w-4" />
                    New Purchase
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-250 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Remaining</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-slate-700">#{p.purchaseNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.vendorName}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(p.purchaseDate)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(p.dueDate)}</td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={p.totalAmount} />
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={p.remainingAmount} tone={Number(p.remainingAmount) > 0 ? 'danger' : 'muted'} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone(p.status)} dot>
                          {p.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {p.paymentStatus && <StatusBadge tone={paymentStatusTone(p.paymentStatus)}>{p.paymentStatus}</StatusBadge>}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu actions={[{ label: 'View Details', icon: EyeIcon, variant: 'view', onClick: () => openDetails(p.id) }]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Purchase modal — manual items only, no product/inventory link */}
      {showNewModal && (
        <Modal
          title="New Purchase"
          onClose={() => setShowNewModal(false)}
          size="xl"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowNewModal(false)} disabled={savingPurchase} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="button" onClick={handleSavePurchase} disabled={savingPurchase} className={primaryButtonClass}>
                {savingPurchase && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {savingPurchase ? 'Saving...' : 'Save Purchase'}
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Vendor" required>
              <select value={newVendorId} onChange={(e) => setNewVendorId(e.target.value)} className={inputClass}>
                <option value="">Select a vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.businessName}
                  </option>
                ))}
              </select>
            </FormField>
            {outlets.length > 0 && (
              <FormField label="Branch" helper="Optional">
                <select value={newOutletId} onChange={(e) => setNewOutletId(e.target.value)} className={inputClass}>
                  <option value="">No specific branch</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Due Date" helper="Optional">
              <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Notes" helper="Optional">
              <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className={inputClass} />
            </FormField>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass}>Items</span>
              <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])} className={ghostButtonClass}>
                <PlusIcon className="h-4 w-4" />
                Add Item
              </button>
            </div>
            <div className="space-y-3">
              {lines.map((l) => {
                const lineTotal = (parseFloat(l.unitCost) || 0) * (parseInt(l.quantity, 10) || 0);
                return (
                  <div key={l.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <label className={labelClass}>Product/Item Name</label>
                        <input
                          value={l.itemName}
                          onChange={(e) => updateLine(l.key, { itemName: e.target.value })}
                          placeholder="e.g. Samsung Galaxy A14 (used)"
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className={labelClass}>Description</label>
                        <input
                          value={l.description}
                          onChange={(e) => updateLine(l.key, { description: e.target.value })}
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className={labelClass}>Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Unit Cost</label>
                        <input
                          type="number"
                          min={0}
                          value={l.unitCost}
                          onChange={(e) => updateLine(l.key, { unitCost: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className={labelClass}>Total</label>
                        <div className="flex h-10.5 items-center text-sm font-semibold text-slate-900">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                      <div className="flex items-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          className={`${ghostButtonClass} hover:bg-red-50 hover:text-red-600`}
                          aria-label="Remove item"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment summary */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">Payment Summary</div>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-slate-500">Purchase Total</span>
              <span className="font-semibold text-slate-900">{formatCurrency(purchaseTotal)}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Initial / Advance Payment" helper="Amount paid to the vendor now — leave 0 if none">
                <input
                  type="number"
                  min={0}
                  max={purchaseTotal}
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Payment Date">
                <input type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} className={inputClass} />
              </FormField>
            </div>
            {initialAmountNum > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Payment Method</label>
                  <select value={initialMethod} onChange={(e) => setInitialMethod(e.target.value as PaymentMethod)} className={inputClass}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="ONLINE_WALLET">Mobile Wallet</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                {initialMethod === 'ONLINE_WALLET' && (
                  <div>
                    <label className={labelClass}>Wallet Provider</label>
                    <select value={initialProvider} onChange={(e) => setInitialProvider(e.target.value)} className={inputClass}>
                      {WALLET_PROVIDERS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {initialMethod === 'BANK_TRANSFER' && (
                  <FormField label="Bank Name">
                    <input value={initialBank} onChange={(e) => setInitialBank(e.target.value)} className={inputClass} />
                  </FormField>
                )}
                <FormField label="Payment Note" helper="Optional">
                  <input value={initialNote} onChange={(e) => setInitialNote(e.target.value)} className={inputClass} />
                </FormField>
                <div className="flex items-start gap-2 pt-6">
                  <input
                    id="initial-deduct"
                    type="checkbox"
                    checked={initialDeduct}
                    onChange={(e) => setInitialDeduct(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="initial-deduct" className="text-xs text-slate-600">
                    Deduct this payment from the Available Sales Cash shown on the dashboard. This will not change Total Sales or Profit.
                  </label>
                </div>
              </div>
            )}
            <div className="mt-3 flex justify-between border-t border-dashed border-slate-300 pt-3 text-sm">
              <span className="text-slate-500">Remaining Amount</span>
              <span className="font-semibold text-red-600">{formatCurrency(initialRemaining)}</span>
            </div>
          </div>

          {formError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
        </Modal>
      )}

      {/* Purchase Details drawer */}
      {detailId && (
        <Drawer title={detail ? `Purchase #${detail.purchaseNumber}` : 'Purchase Details'} subtitle={detail?.vendorName} onClose={closeDetails}>
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <StatusBadge tone={statusTone(detail.status)} dot>
                  {detail.status}
                </StatusBadge>
                {detail.paymentStatus && <StatusBadge tone={paymentStatusTone(detail.paymentStatus)}>{detail.paymentStatus}</StatusBadge>}
              </div>

              <DetailSection title="Purchase Information">
                <DetailItem label="Vendor" value={detail.vendorName} />
                <DetailItem label="Purchase Date" value={formatDate(detail.purchaseDate)} />
                <DetailItem label="Due Date" value={formatDate(detail.dueDate)} />
                {detail.notes && <DetailItem label="Notes" value={detail.notes} className="sm:col-span-2" />}
              </DetailSection>

              <DetailSection title="Amounts">
                <DetailItem label="Purchase Total" value={<PriceDisplay value={detail.totalAmount} size="lg" />} />
                <DetailItem label="Amount Paid" value={<PriceDisplay value={detail.amountPaid} tone="success" />} />
                <DetailItem
                  label="Remaining"
                  value={<PriceDisplay value={detail.remainingAmount} tone={Number(detail.remainingAmount) > 0 ? 'danger' : 'muted'} />}
                />
              </DetailSection>

              <div className="mb-3 text-sm font-semibold text-slate-800">Items</div>
              <div className="mb-6 space-y-2">
                {detail.items.map((i) => (
                  <div key={i.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900">{i.itemName}</div>
                      <div className="font-semibold text-slate-900">{formatCurrency(i.lineTotal)}</div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {i.quantity} × {formatCurrency(i.unitCost)}
                      {i.description ? ` · ${i.description}` : ''}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-3 text-sm font-semibold text-slate-800">Payment History</div>
              <div className="mb-6 space-y-2">
                {detail.payments.length === 0 ? (
                  <EmptyState icon={WalletIcon} title="No payments recorded yet" />
                ) : (
                  detail.payments.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-medium text-slate-900">
                          {formatCurrency(p.amount)}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              p.isInitialPayment ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {p.isInitialPayment ? 'Initial' : 'Later'}
                          </span>
                          {p.reversedAt && <StatusBadge tone="neutral">Deleted</StatusBadge>}
                        </span>
                        <span className="text-slate-500">{formatDate(p.paidAt)}</span>
                      </div>
                      <div className="mt-0.5 text-slate-400">
                        {p.method} · by {p.createdByName}
                        {p.deductFromDashboardCash && !p.reversedAt ? ' · deducted from Available Sales Cash' : ''}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                      {p.reversedAt && (
                        <div className="mt-0.5 text-slate-400">
                          Deleted on {formatDate(p.reversedAt)} by {p.reversedByName ?? 'Unknown'}
                          {p.reversalReason ? `: ${p.reversalReason}` : ''}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {canManage && detail.status === 'ACTIVE' && detail.payments.filter((p) => !p.reversedAt).length === 0 && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCancelTarget(detail);
                      setCancelReason('');
                    }}
                    className={`w-full ${secondaryButtonClass} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                  >
                    Cancel Purchase
                  </button>
                </div>
              )}

              {detail.status === 'ACTIVE' && Number(detail.remainingAmount) > 0 && (
                <button type="button" onClick={() => openPayModal(detail)} className={`w-full ${primaryButtonClass}`}>
                  Record Vendor Payment ({formatCurrency(detail.remainingAmount)})
                </button>
              )}
            </>
          )}
        </Drawer>
      )}

      {/* Cancel confirmation */}
      {cancelTarget && (
        <ConfirmDialog
          title={`Cancel Purchase #${cancelTarget.purchaseNumber}?`}
          description="Only a purchase with no payments recorded can be cancelled."
          confirmLabel={cancelling ? 'Cancelling...' : 'Cancel Purchase'}
          variant="danger"
          loading={cancelling}
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelTarget(null)}
        >
          <FormField label="Reason" helper="Optional">
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} className={inputClass} />
          </FormField>
        </ConfirmDialog>
      )}

      {/* Record Vendor Payment modal */}
      {payTarget && (
        <Modal title={`Record Vendor Payment — Purchase #${payTarget.purchaseNumber}`} onClose={() => setPayTarget(null)} size="sm">
          <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Purchase Total</span>
              <span className="font-medium text-slate-900">{formatCurrency(payTarget.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Already Paid</span>
              <span className="font-medium text-emerald-600">{formatCurrency(payTarget.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-slate-200 pt-1">
              <span className="text-slate-500">Remaining Balance</span>
              <span className="font-semibold text-red-600">{formatCurrency(payTarget.remainingAmount)}</span>
            </div>
          </div>

          <FormField label="Amount">
            <input
              type="number"
              min={0}
              max={Number(payTarget.remainingAmount)}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <div className="mt-3">
            <label className={labelClass}>Payment Method</label>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className={inputClass}>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="ONLINE_WALLET">Mobile Wallet</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>
          {payMethod === 'ONLINE_WALLET' && (
            <div className="mt-3">
              <label className={labelClass}>Wallet Provider</label>
              <select value={payProvider} onChange={(e) => setPayProvider(e.target.value)} className={inputClass}>
                {WALLET_PROVIDERS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          )}
          {payMethod === 'BANK_TRANSFER' && (
            <div className="mt-3">
              <label className={labelClass}>Bank Name</label>
              <input value={payBank} onChange={(e) => setPayBank(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className="mt-3">
            <FormField label="Payment Date">
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Reference" helper="Optional">
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} className={inputClass} placeholder="Note or reference number" />
            </FormField>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <input
              id="pay-deduct"
              type="checkbox"
              checked={payDeduct}
              onChange={(e) => setPayDeduct(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="pay-deduct" className="text-xs text-slate-600">
              Deduct this payment from the Available Sales Cash shown on the dashboard. This will not change Total Sales or Profit.
            </label>
          </div>

          {payError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {payError}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setPayTarget(null)} disabled={paying} className={`flex-1 ${secondaryButtonClass}`}>
              Cancel
            </button>
            <button type="button" onClick={handleConfirmPay} disabled={paying} className={`flex-1 ${primaryButtonClass}`}>
              {paying && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {paying ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
