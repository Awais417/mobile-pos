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
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton, SkeletonCard } from '@/components/ui/Skeletons';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, unitStatusTone, unitStatusLabel } from '@/components/ui/StatusBadge';
import { DetailSection, DetailItem } from '@/components/ui/DetailList';
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
  { value: 'BRAND_NEW_PIN_PACK', label: 'Brand New / Pin Pack' },
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

// One row per Model — every unit sharing the same Model is folded into a
// single record so the table shows "iPhone 13 — Stock 3" instead of one row
// per IMEI. Grouped by the real Model.id (falling back to Product.id only
// for the rare unit whose product has no Model assigned) — never by name —
// so two differently-specced devices of the same model (different color/
// storage/RAM/condition/PTA) still combine, while two genuinely different
// models never do.
interface ModelGroup {
  key: string;
  modelName: string;
  categoryName: string;
  // In-stock unit count only — sold/reserved units are never counted here,
  // even though `units` below (sourced from filteredUnits) may include them
  // if a broader status filter is ever selected.
  stock: number;
  units: ProductUnit[];
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
  const [viewGroup, setViewGroup] = useState<ModelGroup | null>(null);

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

  // Fold filteredUnits down to one row per Model.id (Product.id fallback).
  // Preserves insertion order so the grouped list doesn't jump around as
  // units load.
  const groupedRows = useMemo(() => {
    const map = new Map<string, ModelGroup>();
    for (const u of filteredUnits) {
      const key = u.product?.model?.id
        ? `model-${u.product.model.id}`
        : `product-${u.product?.id ?? u.productId}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          modelName: u.product?.model?.name ?? u.product?.name ?? '—',
          categoryName: u.product?.category?.name ?? '—',
          stock: 0,
          units: [],
        };
        map.set(key, group);
      }
      group.units.push(u);
      if (u.status === 'IN_STOCK') group.stock += 1;
    }
    return Array.from(map.values());
  }, [filteredUnits]);

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

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton />
          ) : groupedRows.length === 0 ? (
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
              <table className="w-full min-w-175 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Category</th>
                    <th className="px-5 py-3.5 font-medium">Model</th>
                    <th className="px-5 py-3.5 font-medium">Stock</th>
                    <th className="px-5 py-3.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((g) => (
                    <tr key={g.key} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-4 text-slate-500">{g.categoryName}</td>
                      <td className="px-5 py-4 text-base font-semibold text-slate-900">{g.modelName}</td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={g.stock > 0 ? 'success' : 'neutral'}>
                          Stock: {formatNumber(g.stock)}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewGroup(g)}
                            aria-label={`View details for ${g.modelName}`}
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

      {viewGroup && (
        <Modal
          title={viewGroup.modelName}
          onClose={() => setViewGroup(null)}
          size="xl"
          panelClassName="sm:!max-w-[88vw] xl:!max-w-[85vw] sm:!min-h-[75vh]"
          headerExtra={
            <StatusBadge tone={viewGroup.stock > 0 ? 'success' : 'neutral'}>
              Stock: {formatNumber(viewGroup.stock)}
            </StatusBadge>
          }
        >
          <p className="-mt-2 mb-6 text-sm text-slate-500">
            {viewGroup.categoryName} · {viewGroup.units.length} unit
            {viewGroup.units.length === 1 ? '' : 's'} on record
          </p>
          <div className="scrollbar-thin -mx-7 overflow-x-auto px-7">
            <table className="w-full min-w-275 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-4 pr-8 font-medium">IMEI / Serial</th>
                  <th className="py-4 pr-8 font-medium">Storage</th>
                  <th className="py-4 pr-8 font-medium">RAM</th>
                  <th className="py-4 pr-8 font-medium">Color</th>
                  <th className="py-4 pr-8 font-medium">Condition</th>
                  <th className="py-4 pr-8 font-medium">PTA Status</th>
                  {isAdmin && <th className="py-4 pr-8 font-medium">Cost Price</th>}
                  <th className="py-4 pr-8 font-medium">Sale Price</th>
                  <th className="py-4 pr-8 font-medium">Status</th>
                  <th className="py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewGroup.units.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap py-4 pr-8 font-mono text-sm text-slate-700">
                      {u.imei1 ?? u.serialNumber ?? '—'}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-8 text-slate-600">{u.product?.storage ?? '—'}</td>
                    <td className="whitespace-nowrap py-4 pr-8 text-slate-600">{u.ram ?? '—'}</td>
                    <td className="whitespace-nowrap py-4 pr-8 text-slate-600">{u.color ?? '—'}</td>
                    <td className="whitespace-nowrap py-4 pr-8 text-slate-600">{conditionLabel(u.deviceCondition)}</td>
                    <td className="whitespace-nowrap py-4 pr-8 text-slate-600">{ptaLabel(u.ptaStatus)}</td>
                    {isAdmin && (
                      <td className="whitespace-nowrap py-4 pr-8 text-slate-600">
                        {u.costPrice != null ? formatCurrency(u.costPrice) : '—'}
                      </td>
                    )}
                    <td className="whitespace-nowrap py-4 pr-8">
                      {u.salePrice != null ? <PriceDisplay value={u.salePrice} size="md" /> : '—'}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-8">
                      <StatusBadge tone={unitStatusTone(u.status)}>{unitStatusLabel(u.status)}</StatusBadge>
                    </td>
                    <td className="py-4">
                      <button
                        onClick={() => {
                          setViewGroup(null);
                          setViewUnit(u);
                        }}
                        aria-label="View unit details"
                        className="cursor-pointer rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {viewUnit && (
        <Modal
          title="Device Details"
          onClose={() => setViewUnit(null)}
          size="lg"
          headerExtra={
            <StatusBadge tone={unitStatusTone(viewUnit.status)} dot>
              {unitStatusLabel(viewUnit.status)}
            </StatusBadge>
          }
        >
          <DetailSection title="Device Identity">
            <DetailItem label="Category" value={viewUnit.product?.category?.name ?? '—'} />
            <DetailItem
              label="Model"
              value={viewUnit.product?.model?.name ?? viewUnit.product?.name ?? '—'}
            />
            <DetailItem label="SKU" value={viewUnit.product?.sku ?? '—'} />
            <DetailItem label="IMEI" value={viewUnit.imei1 ?? '—'} />
            <DetailItem label="IMEI 2" value={viewUnit.imei2 ?? '—'} />
            <DetailItem label="Serial Number" value={viewUnit.serialNumber ?? '—'} />
          </DetailSection>
          <DetailSection title="Specifications & Condition">
            <DetailItem label="RAM" value={viewUnit.ram ?? '—'} />
            <DetailItem label="Storage" value={viewUnit.product?.storage ?? '—'} />
            <DetailItem label="Color" value={viewUnit.color ?? '—'} />
            <DetailItem label="Condition" value={conditionLabel(viewUnit.deviceCondition)} />
            <DetailItem label="PTA Status" value={ptaLabel(viewUnit.ptaStatus)} />
            <DetailItem
              label="Battery Health"
              value={viewUnit.batteryHealth != null ? `${viewUnit.batteryHealth}%` : '—'}
            />
          </DetailSection>
          <DetailSection title="Pricing & Stock">
            {isAdmin && (
              <DetailItem
                label="Cost Price"
                value={viewUnit.costPrice != null ? formatCurrency(viewUnit.costPrice) : '—'}
              />
            )}
            <DetailItem
              label="Selling Price"
              value={viewUnit.salePrice != null ? formatCurrency(viewUnit.salePrice) : '—'}
            />
            <DetailItem label="Stock Status" value={unitStatusLabel(viewUnit.status)} />
          </DetailSection>
          <DetailSection title="Other">
            <DetailItem label="Date Added" value={new Date(viewUnit.createdAt).toLocaleDateString()} />
            <DetailItem label="Supplier" value={viewUnit.supplier ?? '—'} />
            <DetailItem label="Notes" value={viewUnit.notes ?? '—'} className="sm:col-span-2" />
          </DetailSection>
        </Modal>
      )}
    </div>
  );
}
