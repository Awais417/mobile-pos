'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getPayablesSummary,
  getVendorWiseOutstanding,
  getOutstandingBills,
  PayablesSummary,
  VendorOutstandingRow,
  OutstandingBillRow,
} from '@/lib/payables';
import { addPurchasePayment } from '@/lib/purchases';
import { PaymentMethod } from '@/lib/sales';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, SkeletonCard } from '@/components/ui/Skeletons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/components/ui/styles';
import { WalletIcon, AlertTriangleIcon, InboxIcon, Loader2Icon, LandmarkIcon } from '@/components/icons';

const WALLET_PROVIDERS = ['JazzCash', 'Easypaisa', 'Sadapay', 'NayaPay', 'Other'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PayablesPage() {
  const { showToast } = useToast();

  const [summary, setSummary] = useState<PayablesSummary | null>(null);
  const [vendorRows, setVendorRows] = useState<VendorOutstandingRow[]>([]);
  const [bills, setBills] = useState<OutstandingBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dueBefore, setDueBefore] = useState('');

  const [payTarget, setPayTarget] = useState<OutstandingBillRow | null>(null);
  const [payAmount, setPayAmount] = useState('0');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payProvider, setPayProvider] = useState(WALLET_PROVIDERS[0]);
  const [payBank, setPayBank] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, v, b] = await Promise.all([
        getPayablesSummary(),
        getVendorWiseOutstanding(),
        getOutstandingBills({ overdueOnly: overdueOnly || undefined, dueBefore: dueBefore || undefined }),
      ]);
      setSummary(s);
      setVendorRows(v);
      setBills(b);
    } catch {
      showToast('error', 'Could not load payables.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueOnly, dueBefore]);

  const hasActiveFilters = overdueOnly || !!dueBefore;

  function openPayModal(b: OutstandingBillRow) {
    setPayTarget(b);
    setPayAmount(String(Math.round(Number(b.remainingAmount))));
    setPayMethod('CASH');
    setPayProvider(WALLET_PROVIDERS[0]);
    setPayBank('');
    setPayError(null);
  }

  async function handleConfirmPay() {
    if (!payTarget) return;
    const amount = parseFloat(payAmount) || 0;
    const remaining = Number(payTarget.remainingAmount);
    if (amount <= 0 || amount > remaining) {
      setPayError(`Enter an amount up to ${formatCurrency(remaining)}.`);
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      await addPurchasePayment(payTarget.purchaseId, {
        amount,
        method: payMethod,
        provider: payMethod === 'ONLINE_WALLET' ? payProvider : undefined,
        bankName: payMethod === 'BANK_TRANSFER' ? payBank : undefined,
      });
      showToast('success', 'Payment recorded successfully.');
      setPayTarget(null);
      await loadAll();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not record payment.');
    } finally {
      setPaying(false);
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: 'Total Vendor Payable', value: formatCurrency(summary?.totalVendorPayable ?? 0), icon: WalletIcon, color: 'bg-red-50 text-red-600' },
      { label: 'Overdue Amount', value: formatCurrency(summary?.overdueAmount ?? 0), icon: AlertTriangleIcon, color: 'bg-amber-50 text-amber-600' },
    ],
    [summary],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Payables" subtitle="Vendor payables, advances and overdue bills at a glance." />

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loading
            ? Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)
            : summaryCards.map((c) => <SummaryCard key={c.label} {...c} />)}
        </div>

        <div className="mb-3 text-sm font-semibold text-slate-800">Vendor-wise Outstanding</div>
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : vendorRows.length === 0 ? (
            <EmptyState icon={LandmarkIcon} title="No vendor has an outstanding balance" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-100 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Outstanding Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorRows.map((v) => (
                    <tr key={v.vendorId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{v.vendorName}</td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={v.outstandingPayable} tone="danger" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Outstanding Purchase Bills</span>
        </div>

        <FilterToolbar
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setOverdueOnly(false);
            setDueBefore('');
          }}
        >
          <button
            onClick={() => setOverdueOnly((v) => !v)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
              overdueOnly ? 'bg-primary text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Overdue Only
          </button>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500">Due Before</label>
            <input type="date" value={dueBefore} onChange={(e) => setDueBefore(e.target.value)} className={`${inputClass} w-40 py-1.5`} />
          </div>
        </FilterToolbar>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : bills.length === 0 ? (
            <EmptyState icon={InboxIcon} title="No outstanding bills match these filters" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Purchase Date</th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Remaining</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.purchaseId} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-slate-700">#{b.purchaseNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{b.vendorName}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(b.purchaseDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {formatDate(b.dueDate)}
                          {b.isOverdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={b.totalAmount} />
                      </td>
                      <td className="px-4 py-3">
                        <PriceDisplay value={b.remainingAmount} tone="danger" />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openPayModal(b)} className={secondaryButtonClass}>
                          Pay Vendor
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pay Vendor modal */}
      {payTarget && (
        <Modal title={`Pay Vendor — Purchase #${payTarget.purchaseNumber}`} onClose={() => setPayTarget(null)} size="sm">
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
