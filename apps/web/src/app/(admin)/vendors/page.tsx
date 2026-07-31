'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import {
  getVendors,
  getVendor,
  createVendor,
  updateVendor,
  setVendorStatus,
  deleteVendor,
  VendorListItem,
  VendorDetail,
} from '@/lib/vendors';
import { deleteVendorPayment } from '@/lib/vendor-payments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { SearchInput } from '@/components/ui/SearchInput';
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
  primaryButtonClass,
  secondaryButtonClass,
  ghostButtonClass,
} from '@/components/ui/styles';
import {
  LandmarkIcon,
  UsersIcon,
  WalletIcon,
  AlertTriangleIcon,
  PlusIcon,
  EyeIcon,
  Loader2Icon,
  InboxIcon,
  PencilIcon,
  PackageIcon,
  Trash2Icon,
} from '@/components/icons';

type Tab = 'overview' | 'purchases' | 'payments';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'payments', label: 'Payments' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function paymentStatusTone(status: string | null): BadgeTone {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIAL') return 'warning';
  if (status === 'UNPAID') return 'danger';
  return 'neutral';
}

export default function VendorsPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  // Delete Payment — Admin and Accountant only (enforced server-side too).
  const canDeletePayment = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';

  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorListItem | null>(null);
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState<VendorListItem | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // Delete Vendor — permanent, cascades to every purchase/payment belonging
  // to this vendor. Distinct from Deactivate/Reactivate above.
  const [hardDeleteTarget, setHardDeleteTarget] = useState<VendorListItem | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VendorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    amount: string;
    paidAt: string;
    method: string;
  } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingPayment, setDeletingPayment] = useState(false);

  async function loadVendors() {
    try {
      const data = await getVendors({ search: search || undefined, includeArchived: showArchived });
      setVendors(data);
    } catch {
      setError('Could not load vendors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) => v.businessName.toLowerCase().includes(q) || v.phone.includes(q),
    );
  }, [vendors, search]);

  const summary = useMemo(() => {
    const totalVendors = vendors.length;
    const totalPayable = vendors.reduce((s, v) => s + Number(v.remainingPayable), 0);
    const totalPaid = vendors.reduce((s, v) => s + Number(v.totalPaid), 0);
    const activeVendors = vendors.filter((v) => v.isActive).length;
    return { totalVendors, totalPayable, totalPaid, activeVendors };
  }, [vendors]);

  function openAddModal() {
    setEditingVendor(null);
    setFormBusinessName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setShowFormModal(true);
  }

  function openEditModal(v: VendorListItem) {
    setEditingVendor(v);
    setFormBusinessName(v.businessName);
    setFormPhone(v.phone);
    setFormAddress(v.address ?? '');
    setFormNotes(v.notes ?? '');
    setShowFormModal(true);
  }

  async function handleSaveVendor(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        businessName: formBusinessName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim() || undefined,
        notes: formNotes.trim() || undefined,
      };
      if (editingVendor) {
        await updateVendor(editingVendor.id, payload);
        showToast('success', 'Vendor updated successfully.');
      } else {
        await createVendor(payload);
        showToast('success', 'Vendor added successfully.');
      }
      setShowFormModal(false);
      await loadVendors();
      if (detailId) await openDetails(detailId);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not save vendor.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmStatus() {
    if (!statusTarget) return;
    setStatusSaving(true);
    try {
      await setVendorStatus(statusTarget.id, !statusTarget.isActive);
      showToast('success', statusTarget.isActive ? 'Vendor deactivated.' : 'Vendor reactivated.');
      setStatusTarget(null);
      await loadVendors();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update vendor status.');
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleConfirmHardDelete() {
    if (!hardDeleteTarget) return;
    setHardDeleting(true);
    setHardDeleteError(null);
    try {
      await deleteVendor(hardDeleteTarget.id);
      showToast('success', 'Vendor and all its purchases/payments deleted.');
      setHardDeleteTarget(null);
      if (detailId === hardDeleteTarget.id) closeDetails();
      await loadVendors();
    } catch (err) {
      setHardDeleteError(err instanceof Error ? err.message : 'Could not delete this vendor.');
    } finally {
      setHardDeleting(false);
    }
  }

  async function openDetails(id: string) {
    setDetailId(id);
    setDetail(null);
    setActiveTab('overview');
    setLoadingDetail(true);
    try {
      const data = await getVendor(id);
      setDetail(data);
    } catch {
      showToast('error', 'Could not load vendor details.');
      setDetailId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetails() {
    setDetailId(null);
    setDetail(null);
  }

  async function handleConfirmDeletePayment() {
    if (!deleteTarget || !deleteReason.trim()) return;
    setDeletingPayment(true);
    try {
      await deleteVendorPayment(deleteTarget.id, deleteReason.trim());
      showToast('success', 'Payment deleted successfully.');
      setDeleteTarget(null);
      setDeleteReason('');
      if (detailId) await openDetails(detailId);
      await loadVendors();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not delete this payment.');
    } finally {
      setDeletingPayment(false);
    }
  }

  const summaryCards = [
    { label: 'Total Vendors', value: formatNumber(summary.totalVendors), icon: UsersIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Vendors', value: formatNumber(summary.activeVendors), icon: LandmarkIcon, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Paid', value: formatCurrency(summary.totalPaid), icon: WalletIcon, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Payable', value: formatCurrency(summary.totalPayable), icon: WalletIcon, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Vendors"
          subtitle="Manage vendors, purchase history and payables."
          actions={
            isAdmin ? (
              <button type="button" onClick={openAddModal} className={primaryButtonClass}>
                <PlusIcon className="h-4 w-4" />
                Add Vendor
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

        <div className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by vendor name or phone number..." />
        </div>

        {isAdmin && (
          <FilterToolbar hasActiveFilters={showArchived} onClear={() => setShowArchived(false)}>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                showArchived
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {showArchived ? 'Hide Inactive Vendors' : 'Show Inactive Vendors'}
            </button>
          </FilterToolbar>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : filteredVendors.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title={vendors.length === 0 ? 'No vendors yet' : 'No vendors match your search'}
              description={
                vendors.length === 0
                  ? 'Add your first vendor to start recording purchases.'
                  : 'Try a different name or phone number.'
              }
              action={
                vendors.length === 0 && isAdmin ? (
                  <button type="button" onClick={openAddModal} className={primaryButtonClass}>
                    <PlusIcon className="h-4 w-4" />
                    Add Vendor
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-250 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Bills</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Units</th>
                    <th className="px-4 py-3 font-medium">Paid</th>
                    <th className="px-4 py-3 font-medium">Remaining Payable</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{v.businessName}</div>
                        <div className="text-xs text-slate-400">{v.phone}</div>
                      </td>
                      <td className="px-4 py-3">{formatNumber(v.purchaseBillsCount)}</td>
                      <td className="px-4 py-3">{formatNumber(v.distinctItems)}</td>
                      <td className="px-4 py-3">{formatNumber(v.totalUnits)}</td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={v.totalPaid} tone="success" />
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={v.remainingPayable} tone={Number(v.remainingPayable) > 0 ? 'danger' : 'muted'} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={v.isActive ? 'success' : 'neutral'} dot>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          actions={[
                            { label: 'View Details', icon: EyeIcon, variant: 'view', onClick: () => openDetails(v.id) },
                            ...(isAdmin
                              ? [
                                  { label: 'Edit', icon: PencilIcon, variant: 'edit' as const, onClick: () => openEditModal(v) },
                                  {
                                    label: v.isActive ? 'Deactivate' : 'Reactivate',
                                    icon: LandmarkIcon,
                                    variant: 'neutral' as const,
                                    onClick: () => setStatusTarget(v),
                                  },
                                  {
                                    label: 'Delete',
                                    icon: Trash2Icon,
                                    variant: 'delete' as const,
                                    onClick: () => {
                                      setHardDeleteTarget(v);
                                      setHardDeleteError(null);
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Vendor modal — only Business Name, Phone, Address and Note */}
      {showFormModal && (
        <Modal
          title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}
          onClose={() => setShowFormModal(false)}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowFormModal(false)} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" form="vendor-form" disabled={saving} className={primaryButtonClass}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
              </button>
            </div>
          }
        >
          <form id="vendor-form" onSubmit={handleSaveVendor} className="space-y-3">
            <FormField label="Business Name" required>
              <input value={formBusinessName} onChange={(e) => setFormBusinessName(e.target.value)} required className={inputClass} />
            </FormField>
            <FormField label="Phone" required>
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} required className={inputClass} placeholder="03001234567" />
            </FormField>
            <FormField label="Address" helper="Optional">
              <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Note" helper="Optional">
              <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className={inputClass} />
            </FormField>
          </form>
        </Modal>
      )}

      {/* Deactivate/Reactivate confirmation */}
      {statusTarget && (
        <ConfirmDialog
          title={`${statusTarget.isActive ? 'Deactivate' : 'Reactivate'} ${statusTarget.businessName}?`}
          description={
            statusTarget.isActive
              ? 'This vendor will be hidden from active pickers (new purchases). Existing purchases and payment history stay fully intact.'
              : 'This vendor becomes available again for new purchases and payments.'
          }
          confirmLabel={statusSaving ? 'Saving...' : statusTarget.isActive ? 'Deactivate' : 'Reactivate'}
          variant={statusTarget.isActive ? 'danger' : 'primary'}
          loading={statusSaving}
          onConfirm={handleConfirmStatus}
          onCancel={() => setStatusTarget(null)}
        />
      )}

      {/* Delete Vendor confirmation — permanent. Cascades to every purchase
          bill, purchase item, and vendor payment belonging to this vendor. */}
      {hardDeleteTarget && (
        <ConfirmDialog
          title={`Delete ${hardDeleteTarget.businessName}?`}
          description="This permanently deletes this vendor along with every purchase bill, item, and payment linked to them. This cannot be undone."
          confirmLabel={hardDeleting ? 'Deleting...' : 'Delete Vendor'}
          variant="danger"
          loading={hardDeleting}
          onConfirm={handleConfirmHardDelete}
          onCancel={() => setHardDeleteTarget(null)}
        >
          <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Purchase Bills</span>
              <span className="font-medium text-slate-900">{formatNumber(hardDeleteTarget.purchaseBillsCount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remaining Payable</span>
              <span className="font-medium text-slate-900">{formatCurrency(hardDeleteTarget.remainingPayable)}</span>
            </div>
          </div>
          {hardDeleteError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {hardDeleteError}
            </div>
          )}
        </ConfirmDialog>
      )}

      {/* Vendor Details drawer */}
      {detailId && (
        <Drawer title={detail?.businessName ?? 'Vendor Details'} subtitle={detail?.phone} onClose={closeDetails}>
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-100 pb-px">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-medium transition ${
                      activeTab === t.key
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  <DetailSection title="Basic Information">
                    <DetailItem label="Business Name" value={detail.businessName} />
                    <DetailItem label="Phone" value={detail.phone} />
                    <DetailItem label="Status" value={<StatusBadge tone={detail.isActive ? 'success' : 'neutral'} dot>{detail.isActive ? 'Active' : 'Inactive'}</StatusBadge>} />
                    {detail.address && <DetailItem label="Address" value={detail.address} className="sm:col-span-2" />}
                    {detail.notes && <DetailItem label="Note" value={detail.notes} className="sm:col-span-2" />}
                  </DetailSection>

                  {isAdmin && (
                    <div className="mb-6 -mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const v = vendors.find((x) => x.id === detail.id);
                          if (v) openEditModal(v);
                        }}
                        className={ghostButtonClass}
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit Vendor Info
                      </button>
                    </div>
                  )}

                  <DetailSection title="Purchase Summary">
                    <DetailItem label="Total Purchases" value={<PriceDisplay value={detail.summary.totalPurchaseAmount} size="lg" />} />
                    <DetailItem label="Number of Purchase Bills" value={formatNumber(detail.summary.purchaseBillsCount)} />
                    <DetailItem label="Distinct Items" value={formatNumber(detail.summary.distinctItems)} />
                    <DetailItem label="Total Units" value={formatNumber(detail.summary.totalUnits)} />
                  </DetailSection>

                  <DetailSection title="Payables Summary">
                    <DetailItem label="Initial/Advance Payments" value={<PriceDisplay value={detail.summary.initialPayments} />} />
                    <DetailItem label="Later Payments" value={<PriceDisplay value={detail.summary.laterPayments} />} />
                    <DetailItem label="Total Paid" value={<PriceDisplay value={detail.summary.totalPaid} size="lg" tone="success" />} />
                    <DetailItem
                      label="Remaining Payable"
                      value={
                        <PriceDisplay
                          value={detail.summary.remainingPayable}
                          size="lg"
                          tone={Number(detail.summary.remainingPayable) > 0 ? 'danger' : 'muted'}
                        />
                      }
                    />
                  </DetailSection>
                </>
              )}

              {activeTab === 'purchases' && (
                <>
                  {detail.purchases.length === 0 ? (
                    <EmptyState icon={PackageIcon} title="No purchases recorded yet" />
                  ) : (
                    <div className="space-y-3">
                      {detail.purchases.map((p) => (
                        <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">Purchase #{p.purchaseNumber}</div>
                            <div className="flex gap-1.5">
                              <StatusBadge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
                                {p.status}
                              </StatusBadge>
                              {p.paymentStatus && (
                                <StatusBadge tone={paymentStatusTone(p.paymentStatus)}>{p.paymentStatus}</StatusBadge>
                              )}
                            </div>
                          </div>
                          <div className="mb-2 text-xs text-slate-500">
                            {formatDate(p.purchaseDate)} {p.dueDate ? `· Due ${formatDate(p.dueDate)}` : ''} · {p.distinctItems} items · {p.totalUnits} units
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-t border-dashed border-slate-200 pt-2 text-xs">
                            <div>
                              <div className="text-slate-400">Total</div>
                              <div className="font-semibold text-slate-900">{formatCurrency(p.totalAmount)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400">Paid</div>
                              <div className="font-semibold text-emerald-600">{formatCurrency(p.amountPaid)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400">Remaining</div>
                              <div className={`font-semibold ${Number(p.remainingAmount) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {formatCurrency(p.remainingAmount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'payments' && (
                <>
                  {detail.payments.length === 0 ? (
                    <EmptyState icon={WalletIcon} title="No payments recorded yet" />
                  ) : (
                    <div className="space-y-3">
                      {detail.payments.map((p) => (
                        <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">{formatCurrency(p.amount)}</div>
                            {p.reversedAt ? (
                              <StatusBadge tone="neutral">Deleted</StatusBadge>
                            ) : (
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  p.isInitialPayment ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                {p.isInitialPayment ? 'Initial' : 'Later'}
                              </span>
                            )}
                          </div>
                          <div className="mb-1 text-xs text-slate-500">
                            {formatDate(p.paidAt)} · {p.method} · by {p.createdByName}
                            {p.purchaseNumber ? ` · Purchase #${p.purchaseNumber}` : ''}
                          </div>
                          {!p.reversedAt && p.deductFromDashboardCash && (
                            <div className="mt-1 text-[11px] text-amber-600">Deducted from Available Sales Cash</div>
                          )}
                          {p.reversedAt && (
                            <div className="mt-1.5 text-[11px] text-slate-400">
                              Deleted on {formatDate(p.reversedAt)} by {p.reversedByName ?? 'Unknown'}: {p.reversalReason}
                            </div>
                          )}
                          {canDeletePayment && !p.reversedAt && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ id: p.id, amount: p.amount, paidAt: p.paidAt, method: p.method })
                              }
                              className={`mt-2 w-full ${secondaryButtonClass} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                            >
                              Delete Payment
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Drawer>
      )}

      {/* Delete Payment confirmation — Admin and Accountant only (enforced
          server-side). Never a hard delete: kept for history, marked Deleted. */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this vendor payment?"
          confirmLabel={deletingPayment ? 'Deleting...' : 'Delete Payment'}
          variant="danger"
          loading={deletingPayment}
          onConfirm={handleConfirmDeletePayment}
          onCancel={() => setDeleteTarget(null)}
        >
          <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Vendor</span>
              <span className="font-medium text-slate-900">{detail?.businessName ?? '—'}</span>
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
              <span className="font-medium text-slate-900">{deleteTarget.method}</span>
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
