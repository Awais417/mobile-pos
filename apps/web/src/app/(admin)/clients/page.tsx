'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  ClientListItem,
  ClientDetail,
  ClientSale,
  ClientPaymentStatus,
} from '@/lib/clients';
import { addSalePayment, returnSaleItems, voidSale, PaymentMethod } from '@/lib/sales';
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
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  ghostButtonClass,
} from '@/components/ui/styles';
import {
  UsersIcon,
  WalletIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  PlusIcon,
  EyeIcon,
  Loader2Icon,
  InboxIcon,
  SmartphoneIcon,
  ReceiptIcon,
  PencilIcon,
  Trash2Icon,
} from '@/components/icons';

type StatusFilterKey = 'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID';

const STATUS_FILTERS: { key: StatusFilterKey; label: string }[] = [
  { key: 'ALL', label: 'All Statuses' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'UNPAID', label: 'Unpaid' },
];

const WALLET_PROVIDERS = ['JazzCash', 'Easypaisa', 'Sadapay', 'NayaPay', 'Other'];

function statusTone(status: ClientPaymentStatus): BadgeTone {
  if (status === 'PAID') return 'success';
  if (status === 'PARTIAL') return 'warning';
  if (status === 'UNPAID') return 'danger';
  if (status === 'VOIDED') return 'neutral';
  return 'neutral';
}

function statusLabel(status: ClientPaymentStatus): string {
  if (status === 'PAID') return 'Paid';
  if (status === 'PARTIAL') return 'Partial';
  if (status === 'UNPAID') return 'Unpaid';
  if (status === 'VOIDED') return 'Voided';
  return 'No Purchases';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function paymentMethodLabel(
  method: PaymentMethod,
  provider?: string | null,
  bankName?: string | null,
): string {
  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'CARD':
      return 'Card';
    case 'ONLINE_WALLET':
      return provider || 'Wallet';
    case 'BANK_TRANSFER':
      return bankName ? `Bank (${bankName})` : 'Bank Transfer';
    default:
      return method;
  }
}

// The very first payment on a sale is always the checkout-time one (even a
// Rs 0 initial payment gets its own row) — see ClientsService.buildPaymentRows.
function initialPaymentAmount(sale: ClientSale): number {
  return Number(sale.payments.find((p) => p.type === 'INITIAL')?.amount ?? 0);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClientsPage() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('ALL');
  // Admin-only — deleted (archived) clients are hidden by default; toggling
  // this re-fetches including them, purely for historical reference.
  const [showArchived, setShowArchived] = useState(false);

  // Delete Client — Admin only. Backend blocks this unless the client's
  // outstanding balance is exactly 0; see handleConfirmDelete.
  const [deleteTarget, setDeleteTarget] = useState<ClientListItem | ClientDetail | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add Client modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addNote, setAddNote] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // Client Details drawer
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit basic info (Admin only)
  const [editingClient, setEditingClient] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Receive Payment — records a later payment against a client invoice.
  const [payTarget, setPayTarget] = useState<ClientSale | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payProvider, setPayProvider] = useState(WALLET_PROVIDERS[0]);
  const [payBankName, setPayBankName] = useState('');
  const [payDate, setPayDate] = useState(todayIsoDate());
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // Return Items — restores the exact IMEI unit(s)/stock quantity to
  // inventory. Only the not-yet-returned portion of each item is offered.
  const [returnTarget, setReturnTarget] = useState<ClientSale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returningItems, setReturningItems] = useState(false);

  // Void Sale — cancels the whole credit sale, reversing inventory and
  // excluding it from balances. The record itself is preserved (never deleted).
  const [voidTarget, setVoidTarget] = useState<ClientSale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  async function loadClients() {
    try {
      const data = await getClients({ includeArchived: showArchived });
      setClients(data);
    } catch {
      setError('Could not load clients.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (q && !(c.fullName.toLowerCase().includes(q) || c.phone.includes(q))) return false;
      return true;
    });
  }, [clients, search, statusFilter]);

  const summary = useMemo(() => {
    const totalClients = clients.length;
    const withReceivables = clients.filter((c) => Number(c.remainingBalance) > 0).length;
    const totalReceivables = clients.reduce((sum, c) => sum + Number(c.remainingBalance), 0);
    const fullyPaid = clients.filter((c) => c.status === 'PAID').length;
    return { totalClients, withReceivables, totalReceivables, fullyPaid };
  }, [clients]);

  function openAddModal() {
    setAddFullName('');
    setAddPhone('');
    setAddAddress('');
    setAddNote('');
    setShowAddModal(true);
  }

  async function handleAddClient(e: FormEvent) {
    e.preventDefault();
    setSavingClient(true);
    try {
      const result = await createClient({
        fullName: addFullName.trim(),
        phone: addPhone.trim(),
        address: addAddress.trim() || undefined,
        note: addNote.trim() || undefined,
      });
      showToast(
        'success',
        result.existing
          ? `A client with this phone already exists — using "${result.fullName}".`
          : 'Client added successfully.',
      );
      setShowAddModal(false);
      await loadClients();
    } catch {
      showToast('error', 'Could not add client.');
    } finally {
      setSavingClient(false);
    }
  }

  async function openDetails(id: string) {
    setDetailId(id);
    setDetail(null);
    setEditingClient(false);
    setLoadingDetail(true);
    try {
      const data = await getClient(id);
      setDetail(data);
    } catch {
      showToast('error', 'Could not load client details.');
      setDetailId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetails() {
    setDetailId(null);
    setDetail(null);
    setEditingClient(false);
  }

  function startEdit() {
    if (!detail) return;
    setEditFullName(detail.fullName);
    setEditPhone(detail.phone);
    setEditAddress(detail.address ?? '');
    setEditNote(detail.note ?? '');
    setEditingClient(true);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSavingEdit(true);
    try {
      await updateClient(detail.id, {
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim() || undefined,
        note: editNote.trim() || undefined,
      });
      showToast('success', 'Client updated successfully.');
      setEditingClient(false);
      const [refreshedDetail] = await Promise.all([getClient(detail.id), loadClients()]);
      setDetail(refreshedDetail);
    } catch {
      showToast(
        'error',
        'Could not update client. The phone number may already be used by another client.',
      );
    } finally {
      setSavingEdit(false);
    }
  }

  function openDeleteConfirm(client: ClientListItem | ClientDetail) {
    setDeleteTarget(client);
    setDeleteError(null);
  }

  function closeDeleteConfirm() {
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteClient(deleteTarget.id);
      showToast('success', 'Client deleted successfully.');
      closeDeleteConfirm();
      if (detailId === deleteTarget.id) closeDetails();
      await loadClients();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this client.');
    } finally {
      setDeleting(false);
    }
  }

  function openReceivePayment(sale: ClientSale) {
    setPayTarget(sale);
    setPayAmount(String(Math.round(Number(sale.remainingBalance))));
    setPayMethod('CASH');
    setPayProvider(WALLET_PROVIDERS[0]);
    setPayBankName('');
    setPayDate(todayIsoDate());
    setPayNote('');
    setPayError(null);
  }

  function closeReceivePayment() {
    setPayTarget(null);
    setPayError(null);
  }

  async function handleConfirmReceivePayment() {
    if (!payTarget || !detail) return;
    const amountNum = parseFloat(payAmount) || 0;
    const remaining = Number(payTarget.remainingBalance);
    if (amountNum <= 0) {
      setPayError('Enter a valid amount.');
      return;
    }
    if (amountNum > remaining) {
      setPayError(`Amount cannot exceed the remaining balance of ${formatCurrency(remaining)}.`);
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      await addSalePayment(payTarget.id, {
        amount: amountNum,
        method: payMethod,
        provider: payMethod === 'ONLINE_WALLET' ? payProvider : undefined,
        bankName: payMethod === 'BANK_TRANSFER' ? payBankName : undefined,
        note: payNote.trim() || undefined,
        paidAt: payDate || undefined,
      });
      showToast('success', 'Payment recorded successfully.');
      closeReceivePayment();
      const [refreshedDetail] = await Promise.all([getClient(detail.id), loadClients()]);
      setDetail(refreshedDetail);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not record payment.');
    } finally {
      setPaying(false);
    }
  }

  function returnableQty(item: { quantity: number; returnedQuantity: number }): number {
    return item.quantity - item.returnedQuantity;
  }

  function openReturnModal(sale: ClientSale) {
    setReturnTarget(sale);
    setReturnQuantities(
      Object.fromEntries(
        sale.items
          .filter((i) => returnableQty(i) > 0)
          .map((i) => [i.id, String(returnableQty(i))]),
      ),
    );
    setReturnReason('');
    setReturnError(null);
  }

  function closeReturnModal() {
    setReturnTarget(null);
    setReturnError(null);
  }

  async function handleConfirmReturn() {
    if (!returnTarget || !detail) return;
    const lines = Object.entries(returnQuantities)
      .map(([saleItemId, qty]) => ({ saleItemId, quantity: parseInt(qty, 10) || 0 }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      setReturnError('Enter at least one quantity to return.');
      return;
    }
    for (const line of lines) {
      const item = returnTarget.items.find((i) => i.id === line.saleItemId);
      if (item && line.quantity > returnableQty(item)) {
        setReturnError(`Cannot return more than ${returnableQty(item)} of "${item.productName}".`);
        return;
      }
    }

    setReturningItems(true);
    setReturnError(null);
    try {
      await returnSaleItems(returnTarget.id, {
        items: lines,
        reason: returnReason.trim() || undefined,
      });
      showToast('success', 'Item(s) returned and restored to inventory.');
      closeReturnModal();
      const [refreshedDetail] = await Promise.all([getClient(detail.id), loadClients()]);
      setDetail(refreshedDetail);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Could not process the return.');
    } finally {
      setReturningItems(false);
    }
  }

  function openVoidConfirm(sale: ClientSale) {
    setVoidTarget(sale);
    setVoidReason('');
  }

  function closeVoidConfirm() {
    setVoidTarget(null);
    setVoidReason('');
  }

  async function handleConfirmVoid() {
    if (!voidTarget || !detail) return;
    setVoiding(true);
    try {
      await voidSale(voidTarget.id, voidReason.trim() || undefined);
      showToast('success', 'Sale voided — inventory and balance reversed.');
      closeVoidConfirm();
      const [refreshedDetail] = await Promise.all([getClient(detail.id), loadClients()]);
      setDetail(refreshedDetail);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not void this sale.');
    } finally {
      setVoiding(false);
    }
  }

  const hasActiveFilters = statusFilter !== 'ALL' || showArchived;

  const summaryCards = [
    {
      label: 'Total Clients',
      value: formatNumber(summary.totalClients),
      icon: UsersIcon,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Clients with Receivables',
      value: formatNumber(summary.withReceivables),
      icon: AlertTriangleIcon,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total Client Receivables',
      value: formatCurrency(summary.totalReceivables),
      icon: WalletIcon,
      color: 'bg-red-50 text-red-600',
    },
    {
      label: 'Fully Paid Clients',
      value: formatNumber(summary.fullyPaid),
      icon: CheckCircleIcon,
      color: 'bg-emerald-50 text-emerald-600',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Clients"
          subtitle="Manage client purchases, payments, and balances."
          actions={
            <button type="button" onClick={openAddModal} className={primaryButtonClass}>
              <PlusIcon className="h-4 w-4" />
              Add Client
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

        <div className="mb-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by client name or phone number..."
          />
        </div>

        <FilterToolbar
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setStatusFilter('ALL');
            setShowArchived(false);
          }}
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === f.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                showArchived
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {showArchived ? 'Hide Deleted Clients' : 'Show Deleted Clients'}
            </button>
          )}
        </FilterToolbar>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : filteredClients.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title={clients.length === 0 ? 'No clients yet' : 'No clients match your search or filters'}
              description={
                clients.length === 0
                  ? 'Add your first client to start tracking their purchases and payments.'
                  : 'Try a different name, phone number, or status.'
              }
              action={
                clients.length === 0 ? (
                  <button type="button" onClick={openAddModal} className={primaryButtonClass}>
                    <PlusIcon className="h-4 w-4" />
                    Add Client
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-250 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Purchased</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Paid</th>
                    <th className="px-4 py-3 font-medium">Remaining</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Sale Date</th>
                    <th className="px-4 py-3 font-medium">Salesman</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="font-medium text-slate-900">{c.fullName}</div>
                          {c.archivedAt && (
                            <StatusBadge tone="neutral">Deleted</StatusBadge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <SmartphoneIcon className="h-3 w-3 text-slate-400" />
                          {c.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <span className="block max-w-50 truncate">
                          {c.latestSale?.productSummary ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={c.totalAmount} />
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={c.totalPaid} tone="success" />
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay
                          value={c.remainingBalance}
                          tone={Number(c.remainingBalance) > 0 ? 'danger' : 'muted'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone(c.status)} dot>
                          {statusLabel(c.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.latestSale ? formatDate(c.latestSale.date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.latestSale?.salesmanName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          actions={[
                            {
                              label: 'View Details',
                              icon: EyeIcon,
                              variant: 'view',
                              onClick: () => openDetails(c.id),
                            },
                            ...(isAdmin && !c.archivedAt
                              ? [
                                  {
                                    label: 'Delete',
                                    icon: Trash2Icon,
                                    variant: 'delete' as const,
                                    onClick: () => openDeleteConfirm(c),
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

      {/* Add Client modal */}
      {showAddModal && (
        <Modal
          title="Add Client"
          onClose={() => setShowAddModal(false)}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={savingClient}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-client-form"
                disabled={savingClient}
                className={primaryButtonClass}
              >
                {savingClient && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {savingClient ? 'Adding...' : 'Add Client'}
              </button>
            </div>
          }
        >
          <form id="add-client-form" onSubmit={handleAddClient} className="space-y-3">
            <FormField label="Full Name" required>
              <input
                value={addFullName}
                onChange={(e) => setAddFullName(e.target.value)}
                required
                className={inputClass}
                placeholder="e.g. Ahmed Khan"
              />
            </FormField>
            <FormField
              label="Phone Number"
              required
              helper="Used to find this client again and to avoid duplicates."
            >
              <input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                required
                className={inputClass}
                placeholder="03001234567"
              />
            </FormField>
            <FormField label="Address" helper="Optional">
              <input
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Note" helper="Optional">
              <textarea
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Optional"
              />
            </FormField>
          </form>
        </Modal>
      )}

      {/* Client Details drawer */}
      {detailId && (
        <Drawer title={detail?.fullName ?? 'Client Details'} subtitle={detail?.phone} onClose={closeDetails}>
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : editingClient ? (
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <FormField label="Full Name" required>
                <input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className={inputClass}
                />
              </FormField>
              <FormField label="Phone Number" required>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                  className={inputClass}
                />
              </FormField>
              <FormField label="Address" helper="Optional">
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Note" helper="Optional">
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </FormField>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(false)}
                  disabled={savingEdit}
                  className={`flex-1 ${secondaryButtonClass}`}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit} className={`flex-1 ${primaryButtonClass}`}>
                  {savingEdit && <Loader2Icon className="h-4 w-4 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              {detail.archivedAt && (
                <div className="mb-4">
                  <StatusBadge tone="neutral" dot>
                    Deleted on {formatDate(detail.archivedAt)}
                  </StatusBadge>
                </div>
              )}

              <DetailSection title="Basic Information">
                <DetailItem label="Full Name" value={detail.fullName} />
                <DetailItem label="Phone" value={detail.phone} />
                <DetailItem label="Address" value={detail.address ?? '—'} />
                <DetailItem label="Client Since" value={formatDate(detail.createdAt)} />
                {detail.note && (
                  <DetailItem label="Note" value={detail.note} className="sm:col-span-2" />
                )}
              </DetailSection>

              {isAdmin && (
                <div className="mb-6 -mt-4 flex gap-2">
                  <button type="button" onClick={startEdit} className={ghostButtonClass}>
                    <PencilIcon className="h-4 w-4" />
                    Edit Client Info
                  </button>
                  {!detail.archivedAt && (
                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(detail)}
                      className={`${ghostButtonClass} hover:bg-red-50 hover:text-red-600`}
                    >
                      <Trash2Icon className="h-4 w-4" />
                      Delete Client
                    </button>
                  )}
                </div>
              )}

              <DetailSection title="Payment Summary">
                <DetailItem
                  label="Total Purchases"
                  value={<PriceDisplay value={detail.totalAmount} size="lg" />}
                />
                <DetailItem
                  label="Total Paid"
                  value={<PriceDisplay value={detail.totalPaid} size="lg" tone="success" />}
                />
                <DetailItem
                  label="Remaining Balance"
                  value={
                    <PriceDisplay
                      value={detail.remainingBalance}
                      size="lg"
                      tone={Number(detail.remainingBalance) > 0 ? 'danger' : 'muted'}
                    />
                  }
                />
                <DetailItem
                  label="Status"
                  value={
                    <StatusBadge tone={statusTone(detail.status)} dot>
                      {statusLabel(detail.status)}
                    </StatusBadge>
                  }
                />
              </DetailSection>

              <div className="mb-3 text-sm font-semibold text-slate-800">Purchase History</div>
              {detail.sales.length === 0 ? (
                <EmptyState icon={ReceiptIcon} title="No purchases yet" />
              ) : (
                <div className="space-y-3">
                  {detail.sales.map((sale) => (
                    <div key={sale.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          Invoice #{sale.dailyInvoiceNumber}
                        </div>
                        <StatusBadge tone={statusTone(sale.status)} dot>
                          {statusLabel(sale.status)}
                        </StatusBadge>
                      </div>
                      <div className="mb-2 text-xs text-slate-500">
                        {formatDate(sale.createdAt)} · Sold by {sale.salesmanName}
                      </div>
                      <div className="mb-2 space-y-1 border-t border-dashed border-slate-200 pt-2 text-xs text-slate-600">
                        {sale.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span className="truncate pr-2">
                              {item.productName}
                              {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                              {item.returnedQuantity > 0 && (
                                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  {item.returnedQuantity === item.quantity
                                    ? 'Returned'
                                    : `${item.returnedQuantity} returned`}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-medium text-slate-900">
                              {formatCurrency(item.lineTotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-dashed border-slate-200 pt-2 text-xs sm:grid-cols-3">
                        <div>
                          <div className="text-slate-400">
                            Invoice Total{Number(sale.returnedAmount) > 0 ? ' (Net)' : ''}
                          </div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(sale.netAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Initial Payment</div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(initialPaymentAmount(sale))}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Additional Payments</div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(Number(sale.paidAmount) - initialPaymentAmount(sale))}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Total Paid</div>
                          <div className="font-semibold text-emerald-600">
                            {formatCurrency(sale.paidAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Remaining Balance</div>
                          <div
                            className={`font-semibold ${
                              Number(sale.remainingBalance) > 0 ? 'text-red-600' : 'text-slate-400'
                            }`}
                          >
                            {formatCurrency(sale.remainingBalance)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Payment Method</div>
                          <div className="font-semibold text-slate-900">
                            {paymentMethodLabel(sale.paymentMethod)}
                          </div>
                        </div>
                      </div>
                      {Number(sale.returnedAmount) > 0 && (
                        <div className="mt-1.5 text-[11px] text-slate-400">
                          {formatCurrency(sale.returnedAmount)} returned (original total{' '}
                          {formatCurrency(sale.totalAmount)})
                        </div>
                      )}

                      {sale.payments.length > 0 && (
                        <div className="mt-2 border-t border-dashed border-slate-200 pt-2">
                          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Payment History
                          </div>
                          <div className="space-y-1.5">
                            {sale.payments.map((p) => (
                              <div key={p.id} className="rounded-lg bg-slate-50/70 px-2 py-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                                    <span className="truncate">
                                      {formatDate(p.paidAt)} ·{' '}
                                      {paymentMethodLabel(p.method, p.provider, p.bankName)}
                                    </span>
                                    <span
                                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                        p.type === 'INITIAL'
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'bg-purple-50 text-purple-700'
                                      }`}
                                    >
                                      {p.type === 'INITIAL' ? 'Initial' : 'Later'}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-medium text-slate-900">
                                    {formatCurrency(p.amount)}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-400">
                                  {formatCurrency(p.previousBalance)} → {formatCurrency(p.newBalance)}{' '}
                                  · by {p.receivedByName}
                                  {p.note ? ` · ${p.note}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sale.status !== 'VOIDED' && Number(sale.remainingBalance) > 0 && (
                        <button
                          type="button"
                          onClick={() => openReceivePayment(sale)}
                          className={`mt-3 w-full ${primaryButtonClass}`}
                        >
                          Receive Payment ({formatCurrency(sale.remainingBalance)})
                        </button>
                      )}

                      {isAdmin && sale.status !== 'VOIDED' && (
                        <div className="mt-2 flex gap-2">
                          {sale.items.some((i) => returnableQty(i) > 0) && (
                            <button
                              type="button"
                              onClick={() => openReturnModal(sale)}
                              className={`flex-1 ${secondaryButtonClass}`}
                            >
                              Return Items
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openVoidConfirm(sale)}
                            className={`flex-1 ${secondaryButtonClass} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                          >
                            Void Sale
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Every payment across every invoice, newest first — same
                  enriched rows as above, just flattened for an at-a-glance view. */}
              <div className="mb-3 mt-6 text-sm font-semibold text-slate-800">Payment History</div>
              {detail.paymentHistory.length === 0 ? (
                <EmptyState icon={WalletIcon} title="No payments recorded yet" />
              ) : (
                <div className="scrollbar-thin overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-175 text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Invoice</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Previous</th>
                        <th className="px-3 py-2 font-medium">New Balance</th>
                        <th className="px-3 py-2 font-medium">Received By</th>
                        <th className="px-3 py-2 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.paymentHistory.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {formatDate(p.paidAt)}
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700">#{p.invoiceNumber}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                p.type === 'INITIAL'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-purple-50 text-purple-700'
                              }`}
                            >
                              {p.type === 'INITIAL' ? 'Initial Payment' : 'Later Payment'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {paymentMethodLabel(p.method, p.provider, p.bankName)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {formatCurrency(p.previousBalance)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {formatCurrency(p.newBalance)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {p.receivedByName}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{p.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Drawer>
      )}

      {/* Receive Payment modal */}
      {payTarget && detail && (
        <Modal
          title={`Receive Payment — Invoice #${payTarget.dailyInvoiceNumber}`}
          onClose={closeReceivePayment}
          size="sm"
        >
          <div className="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Client</span>
              <span className="font-medium text-slate-900">{detail.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Total</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(payTarget.netAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Previously Paid</span>
              <span className="font-medium text-emerald-600">
                {formatCurrency(payTarget.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between border-t border-dashed border-slate-200 pt-1">
              <span className="text-slate-500">Current Remaining Balance</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(payTarget.remainingBalance)}
              </span>
            </div>
          </div>

          <FormField label="New Payment Amount">
            <input
              type="number"
              min={0}
              max={Number(payTarget.remainingBalance)}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <div className="mt-3">
            <label className={labelClass}>Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              className={inputClass}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="ONLINE_WALLET">Mobile Wallet</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          {payMethod === 'ONLINE_WALLET' && (
            <div className="mt-3">
              <label className={labelClass}>Wallet Provider</label>
              <select
                value={payProvider}
                onChange={(e) => setPayProvider(e.target.value)}
                className={inputClass}
              >
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
              <input
                value={payBankName}
                onChange={(e) => setPayBankName(e.target.value)}
                className={inputClass}
                placeholder="HBL"
              />
            </div>
          )}

          <div className="mt-3">
            <FormField label="Payment Date">
              <input
                type="date"
                value={payDate}
                max={todayIsoDate()}
                onChange={(e) => setPayDate(e.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="mt-3">
            <FormField label="Note" helper="Optional">
              <textarea
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Optional"
              />
            </FormField>
          </div>

          {payTarget.remainingBalance && Number(payAmount || 0) > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              New Remaining Balance:{' '}
              <span className="font-semibold text-slate-900">
                {formatCurrency(Math.max(Number(payTarget.remainingBalance) - (Number(payAmount) || 0), 0))}
              </span>
            </p>
          )}

          {payError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {payError}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={closeReceivePayment}
              disabled={paying}
              className={`flex-1 ${secondaryButtonClass}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReceivePayment}
              disabled={paying}
              className={`flex-1 ${primaryButtonClass}`}
            >
              {paying && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {paying ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </Modal>
      )}

      {/* Return Items modal — restores the not-yet-returned portion of each
          line item to inventory (exact IMEI unit, or stock quantity). */}
      {returnTarget && (
        <Modal
          title={`Return Items — Invoice #${returnTarget.dailyInvoiceNumber}`}
          onClose={closeReturnModal}
          size="md"
        >
          <div className="space-y-3">
            {returnTarget.items
              .filter((item) => returnableQty(item) > 0)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {item.productName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {returnableQty(item)} of {item.quantity} available to return
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={returnableQty(item)}
                    value={returnQuantities[item.id] ?? '0'}
                    onChange={(e) =>
                      setReturnQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="w-20 shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-right text-sm font-semibold text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft"
                  />
                </div>
              ))}
          </div>

          <div className="mt-4">
            <FormField label="Reason" helper="Optional">
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="e.g. Customer changed their mind"
              />
            </FormField>
          </div>

          {returnError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {returnError}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={closeReturnModal}
              disabled={returningItems}
              className={`flex-1 ${secondaryButtonClass}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReturn}
              disabled={returningItems}
              className={`flex-1 ${primaryButtonClass}`}
            >
              {returningItems && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {returningItems ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </Modal>
      )}

      {/* Void Sale confirmation — reverses inventory and excludes this sale
          from the client's balance. The invoice itself is preserved, never deleted. */}
      {voidTarget && (
        <ConfirmDialog
          title={`Void Invoice #${voidTarget.dailyInvoiceNumber}?`}
          description="This cancels the sale entirely: every item is restored to inventory and this sale no longer counts toward the client's balance. The invoice stays visible in history, marked Voided."
          confirmLabel={voiding ? 'Voiding...' : 'Void Sale'}
          variant="danger"
          loading={voiding}
          onConfirm={handleConfirmVoid}
          onCancel={closeVoidConfirm}
        >
          <label className={labelClass} htmlFor="void-reason">
            Reason <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="void-reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. Sale created by mistake"
            rows={2}
            className={inputClass}
          />
        </ConfirmDialog>
      )}

      {/* Delete Client confirmation — Admin only. Backend blocks this (and
          returns a clear message) unless the client's outstanding balance is
          exactly 0. The client is never removed: sales, payments, and
          invoice history stay fully intact and accessible. */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.fullName}?`}
          description="This client will be removed from the active client list and can no longer be selected in POS. Their sales, payments, and invoice history are preserved and remain accessible — nothing is permanently erased."
          confirmLabel={deleting ? 'Deleting...' : 'Delete Client'}
          variant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={closeDeleteConfirm}
        >
          {deleteError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {deleteError}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
