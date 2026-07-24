'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getProductUnits,
  ProductUnit,
  PtaStatus,
  DeviceCondition,
  UnitStatus,
} from '@/lib/product-units';
import { getCategories, Category } from '@/lib/categories';
import { getModels, Model } from '@/lib/models';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PageHeader } from '@/components/ui/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, SkeletonCard } from '@/components/ui/Skeletons';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, unitStatusTone, unitStatusLabel } from '@/components/ui/StatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import {
  AlertTriangleIcon,
  BoxesIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  InboxIcon,
  SmartphoneIcon,
  TagIcon,
} from '@/components/icons';

const PTA_OPTIONS: { value: PtaStatus; label: string }[] = [
  { value: 'PTA', label: 'PTA Approved' },
  { value: 'NON_PTA', label: 'Non-PTA' },
  { value: 'JV', label: 'JV' },
];

const CONDITION_OPTIONS: { value: DeviceCondition; label: string }[] = [
  { value: 'BRAND_NEW', label: 'Brand New' },
  { value: 'OPEN_BOX', label: 'Open Box' },
  { value: 'USED', label: 'Used' },
  { value: 'REFURBISHED', label: 'Refurbished' },
  { value: 'CPO', label: 'CPO' },
];

// UnitStatus enum sirf ye 3 support karta hai — Returned/Repair jaisi
// status abhi schema mein nahi, isliye woh cards/filters yahan nahi dikhate
const STATUS_OPTIONS: { value: UnitStatus; label: string }[] = [
  { value: 'IN_STOCK', label: 'Available' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'RESERVED', label: 'Reserved' },
];

function ptaLabel(pta: PtaStatus | null): string {
  return PTA_OPTIONS.find((o) => o.value === pta)?.label ?? '—';
}

function conditionLabel(condition: DeviceCondition | null | undefined): string {
  return CONDITION_OPTIONS.find((o) => o.value === condition)?.label ?? '—';
}

export default function InventoryPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewUnit, setViewUnit] = useState<ProductUnit | null>(null);

  const [search, setSearch] = useState('');
  // Default view = Available only (the physical warehouse). Sold/Reserved
  // exist only if an admin intentionally picks them from the dropdown below.
  const [statusFilter, setStatusFilter] = useState<'' | UnitStatus>('IN_STOCK');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'' | DeviceCondition>('');
  const [ptaFilter, setPtaFilter] = useState<'' | PtaStatus>('');

  async function loadData() {
    setLoading(true);
    try {
      const [allUnits, cats, mdls] = await Promise.all([
        getProductUnits(),
        getCategories(),
        getModels(),
      ]);
      setUnits(allUnits);
      setCategories(cats);
      setModels(mdls);
    } catch {
      setError('Could not load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Model filter dropdown depends on the selected Category — never shows
  // another category's models, and resets whenever Category changes.
  const modelsForFilter = useMemo(
    () => (categoryFilter ? models.filter((m) => m.categoryId === categoryFilter) : models),
    [models, categoryFilter],
  );

  function handleCategoryFilterChange(id: string) {
    setCategoryFilter(id);
    setModelFilter('');
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('IN_STOCK');
    setCategoryFilter('');
    setModelFilter('');
    setConditionFilter('');
    setPtaFilter('');
  }

  const hasActiveFilters =
    !!search || statusFilter !== 'IN_STOCK' || !!categoryFilter || !!modelFilter || !!conditionFilter || !!ptaFilter;

  // Summary cards hamesha poore (unfiltered) dataset se — displayed/filtered
  // rows se kabhi nahi, taake counts hamesha sahi rahein
  const totalInventory = units.length;
  const availableDevices = units.filter((u) => u.status === 'IN_STOCK').length;
  const soldDevices = units.filter((u) => u.status === 'SOLD').length;
  const reservedDevices = units.filter((u) => u.status === 'RESERVED').length;
  const inventoryValue = units
    .filter((u) => u.status === 'IN_STOCK')
    .reduce((sum, u) => sum + Number(u.costPrice ?? 0), 0);

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (q) {
        const hay = [
          u.product?.name,
          u.product?.sku,
          u.imei1,
          u.imei2,
          u.serialNumber,
          u.color,
          u.product?.storage,
          u.product?.category?.name,
          u.product?.model?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter && u.status !== statusFilter) return false;
      if (categoryFilter && u.product?.category?.id !== categoryFilter) return false;
      if (modelFilter && u.product?.model?.id !== modelFilter) return false;
      if (conditionFilter && u.deviceCondition !== conditionFilter) return false;
      if (ptaFilter && u.ptaStatus !== ptaFilter) return false;
      return true;
    });
  }, [units, search, statusFilter, categoryFilter, modelFilter, conditionFilter, ptaFilter]);

  const cards = [
    { label: 'Total Inventory', value: formatNumber(totalInventory), icon: BoxesIcon, color: 'bg-slate-100 text-slate-600' },
    { label: 'Available', value: formatNumber(availableDevices), icon: SmartphoneIcon, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Sold', value: formatNumber(soldDevices), icon: CheckCircleIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'Reserved', value: formatNumber(reservedDevices), icon: ClockIcon, color: 'bg-purple-50 text-purple-600' },
    ...(isAdmin
      ? [{ label: 'Inventory Value', value: formatCurrency(inventoryValue), icon: TagIcon, color: 'bg-amber-50 text-amber-600' }]
      : []),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Inventory"
          subtitle="View inventory quantities, statuses and values. To add a new phone, use the Products page."
        />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} className="h-28" />)
            : cards.map((c) => <SummaryCard key={c.label} {...c} />)}
        </div>

        {/* Search */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search inventory..."
          />
        </div>

        <FilterToolbar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            disabled={modelsForFilter.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">All Models</option>
            {modelsForFilter.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value as '' | DeviceCondition)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <option value="">All Conditions</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={ptaFilter}
            onChange={(e) => setPtaFilter(e.target.value as '' | PtaStatus)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <option value="">All PTA Statuses</option>
            {PTA_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | UnitStatus)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <option value="">All Availability</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FilterToolbar>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : filteredUnits.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title={units.length === 0 ? 'No inventory records found' : 'No devices found'}
              description={
                units.length === 0
                  ? 'Inventory will appear automatically after products are added from the Products page.'
                  : 'Try adjusting your search or filters.'
              }
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-275 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">IMEI / Serial</th>
                    <th className="px-4 py-3 font-medium">Storage</th>
                    <th className="px-4 py-3 font-medium">Color</th>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">PTA Status</th>
                    {isAdmin && <th className="px-4 py-3 font-medium">Cost Price</th>}
                    <th className="px-4 py-3 font-medium">Selling Price</th>
                    <th className="px-4 py-3 font-medium">Availability</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-500">{u.product?.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{u.product?.model?.name ?? u.product?.name ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {u.imei1 ?? u.serialNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.product?.storage ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{u.color ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{conditionLabel(u.deviceCondition)}</td>
                      <td className="px-4 py-3 text-slate-500">{ptaLabel(u.ptaStatus)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-slate-500">
                          {u.costPrice != null ? formatCurrency(u.costPrice) : '—'}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <PriceDisplay value={u.salePrice} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={unitStatusTone(u.status)}>{unitStatusLabel(u.status)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewUnit(u)}
                            aria-label="View details"
                            className="cursor-pointer rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {viewUnit && (
        <Modal title="Device Details" onClose={() => setViewUnit(null)} size="md">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ['Category', viewUnit.product?.category?.name ?? '—'],
              ['Model', viewUnit.product?.model?.name ?? viewUnit.product?.name ?? '—'],
              ['SKU', viewUnit.product?.sku ?? '—'],
              ['IMEI', viewUnit.imei1 ?? '—'],
              ['IMEI 2', viewUnit.imei2 ?? '—'],
              ['Serial Number', viewUnit.serialNumber ?? '—'],
              ['RAM', viewUnit.ram ?? '—'],
              ['Storage', viewUnit.product?.storage ?? '—'],
              ['Color', viewUnit.color ?? '—'],
              ['PTA Status', ptaLabel(viewUnit.ptaStatus)],
              ['Battery Health', viewUnit.batteryHealth != null ? `${viewUnit.batteryHealth}%` : '—'],
              ['Condition', conditionLabel(viewUnit.deviceCondition)],
              ...(isAdmin
                ? [['Cost Price', viewUnit.costPrice != null ? formatCurrency(viewUnit.costPrice) : '—']]
                : []),
              ['Selling Price', formatCurrency(viewUnit.salePrice)],
              ['Stock Status', unitStatusLabel(viewUnit.status)],
              ['Date Added', new Date(viewUnit.createdAt).toLocaleDateString()],
              ['Supplier', viewUnit.supplier ?? '—'],
              ['Notes', viewUnit.notes ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium text-slate-400">{label}</dt>
                <dd className="text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
