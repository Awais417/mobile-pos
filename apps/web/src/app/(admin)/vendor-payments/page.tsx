'use client';

import { useEffect, useMemo, useState } from 'react';
import { getVendorPayments, deleteVendorPayment, VendorPaymentListItem } from '@/lib/vendor-payments';
import { getVendors, VendorListItem } from '@/lib/vendors';
import { getPurchases, addPurchasePayment, PurchaseListItem } from '@/lib/purchases';
import { PaymentMethod } from '@/lib/sales';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, SkeletonCard } from '@/components/ui/Skeletons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormField } from '@/components/ui/FormField';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/ui/styles';
import { WalletIcon, AlertTriangleIcon, PlusIcon, Loader2Icon, InboxIcon, Trash2Icon } from '@/components/icons';

const WALLET_PROVIDERS = ['JazzCash', 'Easypaisa', 'Sadapay', 'NayaPay', 'Other'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'CARD':
      return 'Card';
    case 'ONLINE_WALLET':
      return 'Mobile Wallet';
    case 'BANK_TRANSFER':
      return 'Bank Transfer';
    default:
      return method;
  }
}

export default function VendorPaymentsPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [payments, setPayments] = useState<VendorPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Admin-only — deleted payments are excluded from the default list;
  // toggling this re-fetches including them, purely for historical reference.
  const [showDeleted, setShowDeleted] = useState(false);

  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [vendorPurchases, setVendorPurchases] = useState<PurchaseListItem[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newVendorId, setNewVendorId] = useState('');
  const [newPurchaseId, setNewPurchaseId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('CASH');
  const [newProvider, setNewProvider] = useState(WALLET_PROVIDERS[0]);
  const [newBank, setNewBank] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newReference, setNewReference] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newDeduct, setNewDeduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Payment — Admin and Accountant only (enforced server-side too).
  const [deleteTarget, setDeleteTarget] = useState<VendorPaymentListItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function loadPayments() {
    try {
      const data = await getVendorPayments(undefined, showDeleted);
      setPayments(data);
    } catch {
      setError('Could not load vendor payments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadPayments();
    getVendors({ includeArchived: false }).then((all) => setVendors(all.filter((v) => v.isActive)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

  useEffect(() => {
    if (!newVendorId) {
      setVendorPurchases([]);
      setNewPurchaseId('');
      return;
    }
    getPurchases({ vendorId: newVendorId, status: 'ACTIVE' }).then((all) => {
      const outstanding = all.filter((p) => Number(p.remainingAmount) > 0);
      setVendorPurchases(outstanding);
      setNewPurchaseId('');
    });
  }, [newVendorId]);

  const selectedPurchase = vendorPurchases.find((p) => p.id === newPurchaseId) ?? null;

  const summary = useMemo(() => {
    const active = payments.filter((p) => !p.reversedAt);
    const totalPayments = active.length;
    const totalAmount = active.reduce((s, p) => s + Number(p.amount), 0);
    const initialAmount = active.filter((p) => p.isInitialPayment).reduce((s, p) => s + Number(p.amount), 0);
    const laterAmount = active.filter((p) => !p.isInitialPayment).reduce((s, p) => s + Number(p.amount), 0);
    const deletedCount = payments.filter((p) => p.reversedAt).length;
    return { totalPayments, totalAmount, initialAmount, laterAmount, deletedCount };
  }, [payments]);

  function openAddModal() {
    setNewVendorId('');
    setNewPurchaseId('');
    setNewAmount('');
    setNewMethod('CASH');
    setNewProvider(WALLET_PROVIDERS[0]);
    setNewBank('');
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewReference('');
    setNewNote('');
    setNewDeduct(false);
    setFormError(null);
    setShowAddModal(true);
  }

  async function handleSavePayment() {
    setFormError(null);
    const amount = parseFloat(newAmount) || 0;
    if (!newVendorId || !newPurchaseId) {
      setFormError('Select a vendor and a purchase.');
      return;
    }
    if (amount <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    if (selectedPurchase && amount > Number(selectedPurchase.remainingAmount)) {
      setFormError(`Amount cannot exceed the remaining balance of ${formatCurrency(selectedPurchase.remainingAmount)}.`);
      return;
    }

    setSaving(true);
    try {
      await addPurchasePayment(newPurchaseId, {
        amount,
        method: newMethod,
        provider: newMethod === 'ONLINE_WALLET' ? newProvider : undefined,
        bankName: newMethod === 'BANK_TRANSFER' ? newBank : undefined,
        referenceNumber: newReference.trim() || undefined,
        note: newNote.trim() || undefined,
        paidAt: newDate || undefined,
        deductFromDashboardCash: newDeduct,
      });
      showToast('success', 'Payment recorded successfully.');
      setShowAddModal(false);
      await loadPayments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record this payment.');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteConfirm(p: VendorPaymentListItem) {
    setDeleteTarget(p);
    setDeleteReason('');
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || !deleteReason.trim()) return;
    setDeleting(true);
    try {
      await deleteVendorPayment(deleteTarget.id, deleteReason.trim());
      showToast('success', 'Payment deleted successfully.');
      setDeleteTarget(null);
      setDeleteReason('');
      await loadPayments();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not delete this payment.');
    } finally {
      setDeleting(false);
    }
  }

  const summaryCards = [
    { label: 'Total Payments', value: formatNumber(summary.totalPayments), icon: WalletIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Paid', value: formatCurrency(summary.totalAmount), icon: WalletIcon, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Initial Payments', value: formatCurrency(summary.initialAmount), icon: WalletIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Later Payments', value: formatCurrency(summary.laterAmount), icon: WalletIcon, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Vendor Payments"
          subtitle="Record and review payments made to vendors against their purchase bills."
          actions={
            <button type="button" onClick={openAddModal} className={primaryButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Add Payment
            </button>
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

        {isAdmin && (
          <FilterToolbar hasActiveFilters={showDeleted} onClear={() => setShowDeleted(false)}>
            <button
              onClick={() => setShowDeleted((v) => !v)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                showDeleted
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {showDeleted ? 'Hide Deleted Payments' : 'Show Deleted Payments'}
            </button>
          </FilterToolbar>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : payments.length === 0 ? (
            <EmptyState icon={InboxIcon} title="No vendor payments recorded yet" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-250 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Purchase</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">By</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-500">{formatDate(p.paidAt)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.vendorName}</td>
                      <td className="px-4 py-3 text-slate-500">{p.purchaseNumber ? `#${p.purchaseNumber}` : '—'}</td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={p.amount} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{paymentMethodLabel(p.method)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            p.isInitialPayment ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {p.isInitialPayment ? 'Initial' : 'Later'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={p.reversedAt ? 'neutral' : 'success'} dot>
                          {p.reversedAt ? 'Deleted' : 'Active'}
                        </StatusBadge>
                        {p.reversedAt && (
                          <div className="mt-1 max-w-50 text-[10px] text-slate-400">
                            {formatDate(p.reversedAt)} by {p.reversedByName ?? 'Unknown'}
                            {p.reversalReason ? `: ${p.reversalReason}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.createdByName}</td>
                      <td className="px-4 py-3">
                        {!p.reversedAt && (
                          <ActionMenu
                            actions={[
                              {
                                label: 'Delete',
                                icon: Trash2Icon,
                                variant: 'delete',
                                onClick: () => openDeleteConfirm(p),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment modal */}
      {showAddModal && (
        <Modal
          title="Record Vendor Payment"
          onClose={() => setShowAddModal(false)}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddModal(false)} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="button" onClick={handleSavePayment} disabled={saving} className={primaryButtonClass}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
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

            {newVendorId && (
              <FormField
                label="Purchase"
                required
                helper={vendorPurchases.length === 0 ? 'No outstanding bills for this vendor.' : undefined}
              >
                <select value={newPurchaseId} onChange={(e) => setNewPurchaseId(e.target.value)} className={inputClass}>
                  <option value="">Select a purchase</option>
                  {vendorPurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.purchaseNumber} — Remaining {formatCurrency(p.remainingAmount)}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Amount" required>
              <input
                type="number"
                min={0}
                max={selectedPurchase ? Number(selectedPurchase.remainingAmount) : undefined}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Payment Date">
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputClass} />
            </FormField>
            <div>
              <label className={labelClass}>Payment Method</label>
              <select value={newMethod} onChange={(e) => setNewMethod(e.target.value as PaymentMethod)} className={inputClass}>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="ONLINE_WALLET">Mobile Wallet</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            {newMethod === 'ONLINE_WALLET' && (
              <div>
                <label className={labelClass}>Wallet Provider</label>
                <select value={newProvider} onChange={(e) => setNewProvider(e.target.value)} className={inputClass}>
                  {WALLET_PROVIDERS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {newMethod === 'BANK_TRANSFER' && (
              <FormField label="Bank Name">
                <input value={newBank} onChange={(e) => setNewBank(e.target.value)} className={inputClass} />
              </FormField>
            )}
            <FormField label="Reference" helper="Optional">
              <input value={newReference} onChange={(e) => setNewReference(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Note" helper="Optional">
              <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} className={inputClass} />
            </FormField>
            <div className="flex items-start gap-2">
              <input
                id="new-deduct"
                type="checkbox"
                checked={newDeduct}
                onChange={(e) => setNewDeduct(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label htmlFor="new-deduct" className="text-xs text-slate-600">
                Deduct this payment from the Available Sales Cash shown on the dashboard. This will not change Total Sales or Profit.
              </label>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Payment confirmation — Admin and Accountant only (enforced
          server-side). Never a hard delete: the payment record is kept for
          history, marked Deleted, and excluded from every total from here on. */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this vendor payment?"
          confirmLabel={deleting ? 'Deleting...' : 'Delete Payment'}
          variant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        >
          <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Vendor</span>
              <span className="font-medium text-slate-900">{deleteTarget.vendorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount</span>
              <span className="font-medium text-slate-900">{formatCurrency(deleteTarget.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Date</span>
              <span className="font-medium text-slate-900">{formatDate(deleteTarget.paidAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method</span>
              <span className="font-medium text-slate-900">{paymentMethodLabel(deleteTarget.method)}</span>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            This removes the payment from the purchase&apos;s remaining balance and from the dashboard&apos;s Available Sales
            Cash (if it was marked for deduction). The payment record is kept for history, marked Deleted.
          </p>
          <FormField label="Deletion Reason" required>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="e.g. Recorded against the wrong vendor"
            />
          </FormField>
        </ConfirmDialog>
      )}
    </div>
  );
}
