'use client';

import { Suspense, useEffect, useMemo, useRef, useState, FormEvent, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  getProductCounts,
  getProductsCatalog,
  getProduct,
  createProduct,
  createPhone,
  updateProduct,
  deleteProduct,
  importProductsCsv,
  Product,
  ProductCounts,
  CatalogItem,
  CatalogPage,
  CatalogQuery,
  CsvImportResult,
  UnitOverride,
} from '@/lib/products';
import {
  updateProductUnit,
  ProductUnit,
  PtaStatus,
  DeviceCondition,
  UnitStatus,
} from '@/lib/product-units';
import { getCategories, Category } from '@/lib/categories';
import { getModels, createModel, Model } from '@/lib/models';
import { isAppleCategory } from '@/lib/device-type';
import { ApiRequestError } from '@/lib/api-client';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  stripDecimalPoint,
  blockDecimalKeyDown,
  blockDecimalPaste,
} from '@/lib/whole-number-input';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeletons';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { StatusBadge, unitStatusTone, unitStatusLabel } from '@/components/ui/StatusBadge';
import { DetailSection, DetailItem } from '@/components/ui/DetailList';
import {
  inputClass,
  labelClass,
  errorClass,
  formSectionTitleClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/ui/styles';
import {
  AlertTriangleIcon,
  BoxesIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  InboxIcon,
  Loader2Icon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
} from '@/components/icons';

const STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];

// Android units capture RAM and Storage as one combined value (e.g.
// "8GB / 128GB") rather than two separate fields — split back into discrete
// ram/storage strings only when building the save payload.
const RAM_STORAGE_OPTIONS = [
  '4GB / 64GB',
  '6GB / 128GB',
  '8GB / 128GB',
  '8GB / 256GB',
  '12GB / 256GB',
  '12GB / 512GB',
];

const COLOR_OPTIONS = [
  'Black',
  'White',
  'Silver',
  'Gold',
  'Graphite',
  'Space Gray',
  'Midnight',
  'Starlight',
  'Blue',
  'Green',
  'Red',
  'Purple',
  'Pink',
  'Natural Titanium',
  'Blue Titanium',
  'White Titanium',
  'Black Titanium',
  'Desert Titanium',
];

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

const CONDITION_GRADE_OPTIONS = [10, 9, 8, 7, 6];

function ptaLabel(pta: PtaStatus | null): string {
  return PTA_OPTIONS.find((o) => o.value === pta)?.label ?? '—';
}

function conditionLabel(condition: DeviceCondition | null | undefined): string {
  return CONDITION_OPTIONS.find((o) => o.value === condition)?.label ?? '—';
}

// A unit's Storage field holds one combined value: for Apple devices it's a
// plain storage string ("128GB"); for everything else it's "RAM / Storage"
// ("8GB / 128GB"). Split back into the two discrete ProductUnit columns the
// backend actually stores — a custom entry that doesn't follow "X / Y" has
// no way to know which half is which, so it's kept whole in storage.
function splitRamStorage(value: string, isApple: boolean): { ram?: string; storage?: string } {
  const v = value.trim();
  if (!v) return { ram: undefined, storage: undefined };
  if (isApple) return { ram: undefined, storage: v };
  const parts = v.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { ram: parts[0], storage: parts.slice(1).join(' / ') };
  return { ram: undefined, storage: v };
}

// SKU is required and must be unique per business, but the admin no longer
// types one in — it's derived from the Device Name plus a timestamp/random
// suffix, the same "silently generated, never a separate manual step" spirit
// already used for Model resolution elsewhere in this form.
function generateSku(deviceName: string): string {
  const base =
    deviceName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 24) || 'DEVICE';
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `${base}-${suffix}`;
}

function buildUnitOverridePayload(u: UnitFormState, isApple: boolean): UnitOverride {
  const { ram, storage } = splitRamStorage(u.storage, isApple);
  return {
    color: u.color.trim() || undefined,
    ram,
    storage,
    deviceCondition: u.deviceCondition || undefined,
    ptaStatus: u.ptaStatus || undefined,
    batteryHealth: u.batteryHealth.trim() ? Number(u.batteryHealth) : undefined,
    conditionGrade: u.conditionGrade.trim() ? Number(u.conditionGrade) : undefined,
    costPrice: u.costPrice.trim() ? Number(u.costPrice) : undefined,
    salePrice: u.salePrice.trim() ? Number(u.salePrice) : undefined,
    notes: u.notes.trim() || undefined,
  };
}

// A unit is "Complete" once every field the backend actually requires is
// filled in and valid — IMEI and Condition always; Cost Price only when the
// admin-only field is visible at all. Selling Price is optional at this
// stage (entered later at POS) but if the user did type one in, it must be
// a valid positive number.
function isUnitComplete(u: UnitFormState, requireCostPrice: boolean): boolean {
  if (!/^\d{15}$/.test(u.imei.trim())) return false;
  if (!u.deviceCondition) return false;
  if (u.salePrice.trim()) {
    const sale = Number(u.salePrice);
    if (Number.isNaN(sale) || sale <= 0) return false;
  }
  if (requireCostPrice) {
    if (!u.costPrice.trim() || Number.isNaN(Number(u.costPrice)) || Number(u.costPrice) < 0) return false;
  }
  if (u.batteryHealth.trim()) {
    const b = Number(u.batteryHealth);
    if (Number.isNaN(b) || b < 0 || b > 100) return false;
  }
  return true;
}

// Grouped-product summary line — e.g. "10 Units Available · Multiple Colors ·
// Mixed Conditions · PTA and Non-PTA". Only meaningful for serialized products
// with more than one in-stock unit; single-unit/accessory rows show nothing.
function unitSummaryText(item: CatalogItem): string | null {
  if (!item.isSerialized || item.stock <= 1) return null;
  const parts = [`${formatNumber(item.stock)} Units Available`];
  parts.push(item.mixedColors ? 'Multiple Colors' : item.color ? `${item.color}` : 'Same Color');
  parts.push(item.mixedConditions ? 'Mixed Conditions' : 'Same Condition');
  if (item.mixedPta) parts.push('PTA and Non-PTA');
  return parts.join(' · ');
}

// ---- Shared small components ----

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  allowAll = false,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T | '') => void;
  allowAll?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowAll && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
            value === ''
              ? 'border-primary bg-primary text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          All
        </button>
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
            value === opt.value
              ? 'border-primary bg-primary text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Searchable dropdown (Color, Storage, RAM/Storage — anywhere a field offers
// predefined options plus a free-text escape hatch) with a clearly separated
// "Custom" entry pinned to the bottom, never mistaken for a real option.
//
// Selecting "Custom" does NOT open a second input below/beside this one — the
// same box simply becomes a plain editable text field from that point on, so
// there is only ever one field on screen. It reverts to picker mode the
// moment its value matches a known option again, or when the dropdown button
// is used to go back and pick from the list.
//
// The open menu is rendered through a portal into document.body, positioned
// via getBoundingClientRect() rather than as a normal `absolute` child. This
// field lives deep inside scrolling/rounded containers (the modal body, a
// unit card) — any of those with overflow-hidden/overflow-auto would clip a
// normal absolutely-positioned dropdown. Escaping to the body sidesteps that
// entirely, and a very high z-index keeps it above every card and modal.
function ComboField({
  value,
  onChange,
  options,
  customLabel = 'Custom',
  customPlaceholder = 'Enter a custom value',
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  customLabel?: string;
  customPlaceholder?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [forceCustom, setForceCustom] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Free text the moment the value isn't one of the known options — this is
  // what lets a saved custom value (e.g. loaded for editing) show correctly
  // without any separate "is this custom" flag having to be persisted.
  const inCustomMode = forceCustom || (!!value && !options.includes(value));
  const filtered = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));

  function measure() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current &&
        !wrapRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the portaled menu glued to its input while any ancestor scrolls
  // (the modal body, an expanded unit card) or the viewport resizes.
  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  useEffect(() => {
    if (inCustomMode) customInputRef.current?.focus();
    // Only run when entering custom mode, not on every keystroke into it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCustomMode]);

  if (inCustomMode) {
    return (
      <div ref={wrapRef} className="relative">
        <input
          ref={customInputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={customPlaceholder}
          className={`${inputClass} w-full pr-9`}
        />
        <button
          type="button"
          onClick={() => {
            setForceCustom(false);
            measure();
            setOpen(true);
            setQuery('');
          }}
          aria-label="Choose from list"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={open ? query : value}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          measure();
          setOpen(true);
          setQuery('');
        }}
        placeholder={value ? value : placeholder}
        className={`${inputClass} pr-9`}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
            className="z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div className="scrollbar-thin max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">No match found</div>
              ) : (
                filtered.map((o) => (
                  <button
                    type="button"
                    key={o}
                    onClick={() => {
                      onChange(o);
                      setForceCustom(false);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      o === value ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    {o}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setForceCustom(true);
                  onChange('');
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-primary transition hover:bg-primary-soft"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                  +
                </span>
                {customLabel}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Searchable category dropdown — Category Terminal se aane wali real categories
function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = 'Search category...',
  allowClear = true,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = categories.find((c) => c.id === value);
  const selectedName = selected ? (selected.isActive ? selected.name : `${selected.name} (archived)`) : '';

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={open ? query : selectedName}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        placeholder={value ? selectedName : placeholder}
        className={`${inputClass} pr-9`}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {open && (
        <div className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
                setQuery('');
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              No category
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No match found</div>
          ) : (
            filtered.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  c.id === value ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600'
                }`}
              >
                {c.name}
                {!c.isActive && <span className="text-slate-400"> (archived)</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Category selection for the Add New Product flow — a full, professional
// card grid (never a cramped dropdown) so category name, type, and selected
// state are all clearly visible at a glance. Search filters by name; the
// grid scrolls internally once there are more categories than fit on screen.
function CategoryCardGrid({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const filtered = term
    ? categories.filter((c) => c.name.toLowerCase().includes(term))
    : categories;

  return (
    <div>
      {categories.length > 6 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search categories..."
          className="mb-4"
        />
      )}
      {filtered.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="No categories match"
          description="Try a different search term."
        />
      ) : (
        <div className="scrollbar-thin max-h-[28rem] overflow-y-auto p-0.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((c) => {
              const selected = c.id === value;
              const Icon = c.isSerialized ? SmartphoneIcon : PackageIcon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange(c.id)}
                  aria-pressed={selected}
                  className={`relative flex min-h-36 flex-col items-center justify-center gap-2.5 rounded-2xl border-2 p-5 text-center transition ${
                    selected
                      ? 'border-primary bg-primary-soft shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                  }`}
                >
                  {selected && (
                    <CheckCircleIcon className="absolute right-3 top-3 h-5 w-5 text-primary" />
                  )}
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span
                    className={`line-clamp-2 text-sm font-semibold ${
                      selected ? 'text-primary' : 'text-slate-900'
                    }`}
                  >
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {c.isSerialized ? 'Serialized (IMEI)' : 'Accessory'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Form state ----

interface ProductFormState {
  categoryId: string;
  name: string;
  sku: string;
  // Serialized (phone) products only — the complete product name, e.g.
  // "iPhone 13 128GB". Feeds Model resolution directly; there's no separate
  // Storage field since this name already carries it.
  modelName: string;
  // Accessories only.
  color: string;
  costPrice: string;
  salePrice: string;
  supplier: string;
  notes: string;
  warrantyDays: string;
  boxIncluded: boolean;
  chargerIncluded: boolean;
  // Quantity: for accessories it's the Total Stock field; for serialized
  // (phone) products it's how many units to create in this one submission —
  // 1 (default/blank) is today's exact single-IMEI flow, unchanged.
  quantity: string;
  // Serialized + quantity > 1 only — one full card per physical unit
  // (index 0 is "Unit 1", etc.), each with its own complete set of fields.
  // Never inherits from another unit implicitly — "Copy Common Values" is
  // the only way values move between units, and only on explicit request.
  units: UnitFormState[];
  reorderLevel: string;
  compatibility: string;
  barcode: string;
}

// One physical phone's own fields — used for every generated unit card.
// `color` and `storage` hold their final value directly (predefined option
// or free-typed custom text) — there's no separate CUSTOM sentinel/companion
// field, since ComboField's own box becomes the custom input in place.
// `storage` means a plain storage value for Apple devices, or a combined
// "RAM / Storage" value otherwise (split apart only when saving).
interface UnitFormState {
  imei: string;
  color: string;
  storage: string;
  deviceCondition: DeviceCondition | '';
  conditionGrade: string;
  ptaStatus: PtaStatus | '';
  batteryHealth: string;
  costPrice: string;
  salePrice: string;
  notes: string;
}

// BRAND_NEW matches the default used everywhere else a device condition is
// collected (Edit Phone's form default, and the Prisma column default) —
// keeping new units consistent with that existing behavior.
const emptyUnitForm: UnitFormState = {
  imei: '',
  color: '',
  storage: '',
  deviceCondition: 'BRAND_NEW',
  conditionGrade: '',
  ptaStatus: '',
  batteryHealth: '',
  costPrice: '',
  salePrice: '',
  notes: '',
};

const emptyProductForm: ProductFormState = {
  categoryId: '',
  name: '',
  sku: '',
  modelName: '',
  color: '',
  costPrice: '',
  salePrice: '',
  supplier: '',
  notes: '',
  warrantyDays: '',
  boxIncluded: true,
  chargerIncluded: true,
  quantity: '',
  units: [emptyUnitForm],
  reorderLevel: '',
  compatibility: '',
  barcode: '',
};

interface PhoneFormState {
  categoryId: string;
  modelName: string;
  ram: string;
  storage: string;
  customStorage: string;
  imei1: string;
  imei2: string;
  serialNumber: string;
  color: string;
  ptaStatus: PtaStatus | '';
  deviceCondition: DeviceCondition;
  conditionGrade: string;
  batteryHealth: string;
  costPrice: string;
  salePrice: string;
  supplier: string;
  notes: string;
  warrantyDays: string;
  boxIncluded: boolean;
  chargerIncluded: boolean;
}

const emptyPhoneForm: PhoneFormState = {
  categoryId: '',
  modelName: '',
  ram: '',
  storage: '',
  customStorage: '',
  imei1: '',
  imei2: '',
  serialNumber: '',
  color: '',
  ptaStatus: '',
  deviceCondition: 'BRAND_NEW',
  conditionGrade: '',
  batteryHealth: '',
  costPrice: '',
  salePrice: '',
  supplier: '',
  notes: '',
  warrantyDays: '',
  boxIncluded: true,
  chargerIncluded: true,
};

interface AccessoryFormState {
  categoryId: string;
  name: string;
  barcode: string;
  color: string;
  compatibility: string;
  costPrice: string;
  salePrice: string;
  stockQty: string;
  reorderLevel: string;
}

const emptyAccessoryForm: AccessoryFormState = {
  categoryId: '',
  name: '',
  barcode: '',
  color: '',
  compatibility: '',
  costPrice: '',
  salePrice: '',
  stockQty: '',
  reorderLevel: '',
};

type ModalState =
  | { type: 'closed' }
  | { type: 'add-product' }
  | { type: 'edit-phone'; unit: ProductUnit }
  | { type: 'edit-accessory'; product: Product }
  | { type: 'view-phone'; unit: ProductUnit }
  | { type: 'view-accessory'; product: Product }
  // Serialized product with more than one unit (from a batch add) — a simple
  // list of its units, each with its own Edit action into the existing
  // edit-phone flow. Single-unit serialized products skip this and go
  // straight to view-phone/edit-phone, unchanged.
  | { type: 'view-product-units'; product: Product & { units: ProductUnit[] } }
  | { type: 'confirm-delete-phone'; unit: ProductUnit }
  | { type: 'confirm-delete-accessory'; product: Product }
  | { type: 'confirm-delete-product'; productId: string; name: string };

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const SORT_OPTIONS: { value: string; label: string; sortBy: CatalogQuery['sortBy']; sortOrder: CatalogQuery['sortOrder'] }[] = [
  { value: 'newest', label: 'Newest', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'oldest', label: 'Oldest', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'name_asc', label: 'Product Name (A-Z)', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: 'Product Name (Z-A)', sortBy: 'name', sortOrder: 'desc' },
  { value: 'stock_asc', label: 'Stock Quantity (Low-High)', sortBy: 'stock', sortOrder: 'asc' },
  { value: 'stock_desc', label: 'Stock Quantity (High-Low)', sortBy: 'stock', sortOrder: 'desc' },
  { value: 'price_asc', label: 'Sale Price (Low-High)', sortBy: 'price', sortOrder: 'asc' },
  { value: 'price_desc', label: 'Sale Price (High-Low)', sortBy: 'price', sortOrder: 'desc' },
];

const unitsFilterSelectClass =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100';

// View Units — the drawer opened for any grouped serialized product with more
// than one unit. Shows every unit's own Color/Condition/PTA Status/Battery
// Health/Cost/Sale Price/Status (never a single shared value for the whole
// product), and supports searching/filtering that list by IMEI, Color,
// Condition, PTA Status, and Stock Status.
function ViewUnitsModal({
  product,
  search,
  onSearchChange,
  conditionFilter,
  onConditionFilterChange,
  ptaFilter,
  onPtaFilterChange,
  statusFilter,
  onStatusFilterChange,
  isAdmin,
  onClose,
  onViewUnit,
  onEditUnit,
}: {
  product: Product & { units: ProductUnit[] };
  search: string;
  onSearchChange: (v: string) => void;
  conditionFilter: '' | DeviceCondition;
  onConditionFilterChange: (v: '' | DeviceCondition) => void;
  ptaFilter: '' | PtaStatus;
  onPtaFilterChange: (v: '' | PtaStatus) => void;
  statusFilter: '' | UnitStatus;
  onStatusFilterChange: (v: '' | UnitStatus) => void;
  isAdmin: boolean;
  onClose: () => void;
  onViewUnit: (u: ProductUnit) => void;
  onEditUnit: (u: ProductUnit) => void;
}) {
  const term = search.trim().toLowerCase();
  const filteredUnits = product.units.filter((u) => {
    if (conditionFilter && u.deviceCondition !== conditionFilter) return false;
    if (ptaFilter && u.ptaStatus !== ptaFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    if (term) {
      const haystack = [u.imei1, u.imei2, u.serialNumber, u.color].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  return (
    <Modal
      title={product.name}
      onClose={onClose}
      size="xl"
      headerExtra={
        <StatusBadge tone="neutral">{product.units.length} units total</StatusBadge>
      }
    >
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {[product.category?.name, product.model?.name, product.sku].filter(Boolean).join(' · ')}
      </p>

      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search by IMEI, serial number, or color..."
        className="mb-3"
      />
      <FilterToolbar
        hasActiveFilters={!!conditionFilter || !!ptaFilter || !!statusFilter}
        onClear={() => {
          onConditionFilterChange('');
          onPtaFilterChange('');
          onStatusFilterChange('');
        }}
      >
        <select
          value={conditionFilter}
          onChange={(e) => onConditionFilterChange(e.target.value as '' | DeviceCondition)}
          className={unitsFilterSelectClass}
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
          onChange={(e) => onPtaFilterChange(e.target.value as '' | PtaStatus)}
          className={unitsFilterSelectClass}
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
          onChange={(e) => onStatusFilterChange(e.target.value as '' | UnitStatus)}
          className={unitsFilterSelectClass}
        >
          <option value="">Any Stock Status</option>
          <option value="IN_STOCK">Available</option>
          <option value="SOLD">Sold</option>
          <option value="RESERVED">Reserved</option>
        </select>
      </FilterToolbar>

      {filteredUnits.length === 0 ? (
        <EmptyState icon={InboxIcon} title="No units match" description="Try adjusting the search or filters." />
      ) : (
        <div className="scrollbar-thin -mx-7 overflow-x-auto px-7">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3 pr-4 font-medium">IMEI</th>
                <th className="py-3 pr-4 font-medium">Color</th>
                <th className="py-3 pr-4 font-medium">Condition</th>
                <th className="py-3 pr-4 font-medium">PTA Status</th>
                <th className="py-3 pr-4 font-medium">Battery</th>
                <th className="py-3 pr-4 font-medium">Cost Price</th>
                <th className="py-3 pr-4 font-medium">Sale Price</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUnits.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="py-3 pr-4 font-mono text-xs text-slate-700">
                    {u.imei1 ?? u.serialNumber ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{u.color ?? '—'}</td>
                  <td className="py-3 pr-4 text-slate-600">{conditionLabel(u.deviceCondition)}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={u.ptaStatus === 'PTA' ? 'success' : u.ptaStatus ? 'warning' : 'neutral'}>
                      {ptaLabel(u.ptaStatus)}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {u.batteryHealth != null ? `${u.batteryHealth}%` : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    {u.costPrice != null ? <PriceDisplay value={u.costPrice} size="sm" /> : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    {u.salePrice != null ? <PriceDisplay value={u.salePrice} size="sm" /> : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={unitStatusTone(u.status)}>{unitStatusLabel(u.status)}</StatusBadge>
                  </td>
                  <td className="py-3">
                    <ActionMenu
                      actions={[
                        {
                          label: 'View',
                          icon: EyeIcon,
                          variant: 'view',
                          onClick: () => onViewUnit(u),
                        },
                        ...(isAdmin
                          ? [
                              {
                                label: 'Edit',
                                icon: PencilIcon,
                                variant: 'edit' as const,
                                onClick: () => onEditUnit(u),
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
    </Modal>
  );
}

// One physical phone's full field set, generated once per unit whenever the
// serialized Add Product form is open — deliberately built from the exact
// same dropdown components/options as the rest of this form (ComboField,
// CONDITION_OPTIONS, CONDITION_GRADE_OPTIONS, PTA_OPTIONS) so Unit 1 and Unit
// N are never inconsistent, and so any future change to those shared lists
// automatically applies here too. Storage is a single value for Apple
// devices (from STORAGE_OPTIONS) or a combined "RAM / Storage" value for
// everything else (from RAM_STORAGE_OPTIONS).
function UnitCard({
  index,
  unit,
  expanded,
  onToggleExpand,
  onChange,
  isAdmin,
  isApple,
  errors,
}: {
  index: number;
  unit: UnitFormState;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: <K extends keyof UnitFormState>(key: K, value: UnitFormState[K]) => void;
  isAdmin: boolean;
  isApple: boolean;
  errors: {
    imei?: string;
    condition?: string;
    battery?: string;
    cost?: string;
    sale?: string;
  };
}) {
  const complete = isUnitComplete(unit, isAdmin);
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50/70"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Unit {index + 1}</div>
            <div className="truncate font-mono text-xs text-slate-400">
              {unit.imei || 'No IMEI yet'}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge tone={complete ? 'success' : 'warning'} dot>
            {complete ? 'Complete' : 'Incomplete'}
          </StatusBadge>
          <ChevronDownIcon
            className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass}>
              IMEI <span className="text-red-500">*</span>
            </label>
            <input
              value={unit.imei}
              onChange={(e) => onChange('imei', e.target.value.replace(/[^0-9]/g, '').slice(0, 15))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              inputMode="numeric"
              maxLength={15}
              placeholder="15-digit IMEI"
              className={`${inputClass} font-mono`}
            />
            {errors.imei && <p className={errorClass}>{errors.imei}</p>}
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <ComboField
              value={unit.color}
              onChange={(v) => onChange('color', v)}
              options={COLOR_OPTIONS}
              customLabel="Other / Custom Color"
              customPlaceholder="Enter Custom Color"
              placeholder="Search color..."
            />
          </div>
          <div>
            <label className={labelClass}>
              Condition <span className="text-red-500">*</span>
            </label>
            <select
              value={unit.deviceCondition}
              onChange={(e) => onChange('deviceCondition', e.target.value as DeviceCondition | '')}
              className={inputClass}
            >
              <option value="">Select condition</option>
              {CONDITION_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.condition && <p className={errorClass}>{errors.condition}</p>}
          </div>
          <div>
            <label className={labelClass}>{isApple ? 'Storage' : 'RAM / Storage'}</label>
            <ComboField
              value={unit.storage}
              onChange={(v) => onChange('storage', v)}
              options={isApple ? STORAGE_OPTIONS : RAM_STORAGE_OPTIONS}
              customLabel="Custom"
              customPlaceholder={isApple ? 'Enter Custom Storage' : 'e.g. 16GB / 512GB'}
              placeholder={isApple ? 'Search storage...' : 'Search RAM / Storage...'}
            />
          </div>
          <div>
            <label className={labelClass}>10/10 Grade</label>
            <select
              value={unit.conditionGrade}
              onChange={(e) => onChange('conditionGrade', e.target.value)}
              className={inputClass}
            >
              <option value="">Not rated</option>
              {CONDITION_GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}/10
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>PTA Status</label>
            <select
              value={unit.ptaStatus}
              onChange={(e) => onChange('ptaStatus', e.target.value as PtaStatus | '')}
              className={inputClass}
            >
              <option value="">Not specified</option>
              {PTA_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {isApple && (
            <div>
              <label className={labelClass}>Battery Health</label>
              <div className="relative">
                <input
                  value={unit.batteryHealth}
                  onChange={(e) => onChange('batteryHealth', e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                  placeholder="e.g. 92"
                  className={`${inputClass} pr-8`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  %
                </span>
              </div>
              {errors.battery && <p className={errorClass}>{errors.battery}</p>}
            </div>
          )}
          {isAdmin && (
            <div>
              <label className={labelClass}>
                Cost Price <span className="text-red-500">*</span>
              </label>
              <input
                value={unit.costPrice}
                onChange={(e) => onChange('costPrice', stripDecimalPoint(e.target.value))}
                onKeyDown={blockDecimalKeyDown}
                onPaste={blockDecimalPaste}
                type="number"
                step="1"
                className={inputClass}
              />
              {errors.cost && <p className={errorClass}>{errors.cost}</p>}
            </div>
          )}
          <div>
            <label className={labelClass}>
              Sale Price <span className="text-slate-400">(optional — can be set at POS)</span>
            </label>
            <input
              value={unit.salePrice}
              onChange={(e) => onChange('salePrice', stripDecimalPoint(e.target.value))}
              onKeyDown={blockDecimalKeyDown}
              onPaste={blockDecimalPaste}
              type="number"
              step="1"
              className={inputClass}
            />
            {errors.sale && <p className={errorClass}>{errors.sale}</p>}
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={labelClass}>
              Note <span className="text-slate-400">(optional — internal, this unit only)</span>
            </label>
            <textarea
              value={unit.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder="e.g. Minor scratch on back, Face ID not working..."
              rows={2}
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// A smaller stand-in for the shared SummaryCard, used only on this page so
// the product table starts higher on screen — SummaryCard itself is left
// untouched since Dashboard/Inventory/Sales History still rely on its full size.
function CompactStatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-slate-500">{label}</div>
        <div className="text-lg font-bold leading-tight text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function ProductsContent() {
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  const [categories, setCategories] = useState<Category[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [counts, setCounts] = useState<ProductCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResult | null>(null);

  const [modal, setModal] = useState<ModalState>({ type: 'closed' });
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [phoneForm, setPhoneForm] = useState<PhoneFormState>(emptyPhoneForm);
  const [accessoryForm, setAccessoryForm] = useState<AccessoryFormState>(emptyAccessoryForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [optionalOpen, setOptionalOpen] = useState(false);

  // View Units modal — local search/filter over the already-loaded unit list
  // (no extra request; a single product's units are never large enough to
  // need server-side paging). Reset whenever a different product is opened.
  const [unitsSearch, setUnitsSearch] = useState('');
  const [unitsConditionFilter, setUnitsConditionFilter] = useState<'' | DeviceCondition>('');
  const [unitsPtaFilter, setUnitsPtaFilter] = useState<'' | PtaStatus>('');
  const [unitsStatusFilter, setUnitsStatusFilter] = useState<'' | UnitStatus>('');

  // Add Product (batch, quantity > 1) — which unit cards are expanded. New
  // units default to collapsed once there are several, so the form stays
  // scannable; toggled individually or in bulk via Expand All/Collapse All.
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({});

  // Table — server-side paginated/filtered/sorted. searchInput updates every
  // keystroke (for a responsive box); debouncedSearch is what actually goes
  // to the backend, ~350ms after typing stops.
  const [catalog, setCatalog] = useState<CatalogPage | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'' | 'IN_STOCK' | 'LOW_STOCK'>('');
  const [sortOption, setSortOption] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets to page 1 — a filtered result set doesn't have
  // the same number of pages as the last one.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, stockStatusFilter, sortOption, limit]);

  const hasActiveFilters = !!debouncedSearch || !!categoryFilter || !!stockStatusFilter;

  function clearFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryFilter('');
    setStockStatusFilter('');
  }

  async function loadCatalog() {
    setCatalogLoading(true);
    const sort = SORT_OPTIONS.find((s) => s.value === sortOption) ?? SORT_OPTIONS[0];
    try {
      const data = await getProductsCatalog({
        page,
        limit,
        search: debouncedSearch || undefined,
        categoryId: categoryFilter || undefined,
        stockStatus: stockStatusFilter || undefined,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
      });
      setCatalog(data);
    } catch {
      setError('Could not load products.');
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, categoryFilter, stockStatusFilter, sortOption]);

  // Sirf active categories Add Product form mein aati hain. Edit forms
  // ke liye alag se (neeche) — wahan current (archived ho to bhi) category
  // dikhni chahiye.
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);

  function categoryOptionsForEdit(expectedIsSerialized: boolean, currentCategoryId: string) {
    return categories.filter(
      (c) => c.isSerialized === expectedIsSerialized && (c.isActive || c.id === currentCategoryId),
    );
  }

  async function loadData() {
    try {
      const [cats, cnts, mdls] = await Promise.all([
        getCategories(),
        getProductCounts(),
        getModels(),
      ]);
      setCategories(cats);
      setCounts(cnts);
      setModels(mdls);
    } catch {
      setError('Could not load data.');
    } finally {
      setLoading(false);
    }
  }

  // Refreshes everything a stock-affecting action needs to stay in sync:
  // the table (catalog), the page-header stats, and the category filter's
  // options — without requiring a manual page refresh.
  async function refreshAfterChange() {
    await Promise.all([loadCatalog(), loadData()]);
  }

  // Model field is a plain text name — no separate "create model" step for
  // the user. Reuses an existing model under the category (case-insensitive
  // match, active or archived) if one exists, otherwise creates it silently
  // as part of saving the product.
  async function resolveModelId(categoryId: string, rawName: string): Promise<string> {
    const name = rawName.trim();
    const existing = models.find(
      (m) => m.categoryId === categoryId && m.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    try {
      const created = await createModel({ categoryId, name });
      return created.id;
    } catch (err) {
      if (err instanceof ApiRequestError && err.statusCode === 409) {
        const refreshed = await getModels({ categoryId });
        const match = refreshed.find((m) => m.name.toLowerCase() === name.toLowerCase());
        if (match) return match.id;
      }
      throw err;
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateProductField<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    setProductForm((prev) => ({ ...prev, [key]: value }));
  }

  // Serialized-quantity change — resizes the `units` array to match, keeping
  // whatever the user already entered in the slots that still exist. New
  // slots start fully blank (never inherit another unit's values) — the only
  // way values move between units is the explicit "Copy Common Values" action.
  // Always at least one unit — Unit 1 is a generated card just like Unit N,
  // never a separate flat form, even when Quantity is left at 1.
  function updatePhoneQuantity(value: string) {
    setProductForm((prev) => {
      const n = value.trim() === '' ? 1 : Math.max(1, Math.floor(Number(value) || 1));
      const units = Array.from({ length: n }, (_, i) => prev.units[i] ?? emptyUnitForm);
      return { ...prev, quantity: value, units };
    });
    // Newly generated cards should be immediately visible and ready to fill,
    // not hidden behind an extra "Expand" click.
    setExpandedUnits((prev) => {
      const n = value.trim() === '' ? 1 : Math.max(1, Math.floor(Number(value) || 1));
      const next = { ...prev };
      for (let i = 0; i < n; i++) next[i] = true;
      return next;
    });
  }

  function updateUnitField<K extends keyof UnitFormState>(
    index: number,
    key: K,
    value: UnitFormState[K],
  ) {
    setProductForm((prev) => {
      const next = [...prev.units];
      next[index] = { ...(next[index] ?? emptyUnitForm), [key]: value };
      return { ...prev, units: next };
    });
  }

  function expandAllUnits() {
    setExpandedUnits(Object.fromEntries(productForm.units.map((_, i) => [i, true])));
  }

  function collapseAllUnits() {
    setExpandedUnits({});
  }

  // Copies Unit 1's Color/Condition/Storage/Grade/PTA/Cost/Sale Price onto
  // every other unit — IMEI and Battery Health are never touched, since every physical
  // device has its own identity and its own battery wear. The user can still
  // edit any unit individually afterwards.
  function copyCommonValuesToAllUnits() {
    setProductForm((prev) => {
      const first = prev.units[0];
      if (!first) return prev;
      const next = prev.units.map((u, i) =>
        i === 0
          ? u
          : {
              ...u,
              color: first.color,
              storage: first.storage,
              deviceCondition: first.deviceCondition,
              conditionGrade: first.conditionGrade,
              ptaStatus: first.ptaStatus,
              costPrice: first.costPrice,
              salePrice: first.salePrice,
            },
      );
      return { ...prev, units: next };
    });
  }

  function updatePhoneField<K extends keyof PhoneFormState>(key: K, value: PhoneFormState[K]) {
    setPhoneForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAccessoryField<K extends keyof AccessoryFormState>(
    key: K,
    value: AccessoryFormState[K],
  ) {
    setAccessoryForm((prev) => ({ ...prev, [key]: value }));
  }

  function closeModal() {
    setModal({ type: 'closed' });
    setProductForm(emptyProductForm);
    setPhoneForm(emptyPhoneForm);
    setAccessoryForm(emptyAccessoryForm);
    setErrors({});
    setOptionalOpen(false);
  }

  function openAddProduct() {
    // Pre-fill whatever category is currently selected in the filter toolbar,
    // if any — a convenience, not a requirement.
    const preselected = categoryFilter ? activeCategories.find((c) => c.id === categoryFilter) : undefined;
    setProductForm({
      ...emptyProductForm,
      categoryId: preselected?.id ?? '',
    });
    setErrors({});
    setOptionalOpen(false);
    setExpandedUnits({ 0: true });
    setModal({ type: 'add-product' });
  }

  function openEditPhone(unit: ProductUnit) {
    const storageVal = unit.product?.storage ?? '';
    const isKnownStorage = STORAGE_OPTIONS.includes(storageVal);
    const colorVal = unit.color ?? '';
    setPhoneForm({
      categoryId: unit.product?.category?.id ?? '',
      modelName: unit.product?.model?.name ?? '',
      ram: unit.ram ?? '',
      storage: isKnownStorage ? storageVal : storageVal ? 'CUSTOM' : '',
      customStorage: isKnownStorage ? '' : storageVal,
      imei1: unit.imei1 ?? '',
      imei2: unit.imei2 ?? '',
      serialNumber: unit.serialNumber ?? '',
      color: colorVal,
      ptaStatus: unit.ptaStatus ?? '',
      deviceCondition: unit.deviceCondition,
      conditionGrade: unit.conditionGrade != null ? String(unit.conditionGrade) : '',
      batteryHealth: unit.batteryHealth != null ? String(unit.batteryHealth) : '',
      costPrice: unit.costPrice ?? '',
      salePrice: unit.salePrice ?? '',
      supplier: unit.supplier ?? '',
      notes: unit.notes ?? '',
      warrantyDays: String(unit.warrantyDays ?? 0),
      boxIncluded: unit.boxIncluded,
      chargerIncluded: unit.chargerIncluded,
    });
    setErrors({});
    setOptionalOpen(!!(unit.supplier || unit.notes || unit.warrantyDays));
    setModal({ type: 'edit-phone', unit });
  }

  function openEditAccessory(p: Product) {
    setAccessoryForm({
      categoryId: p.categoryId || '',
      name: p.name || '',
      barcode: p.barcode || '',
      color: p.color || '',
      compatibility: p.compatibility || '',
      costPrice: p.costPrice || '',
      salePrice: p.salePrice || '',
      stockQty: p.stockQty != null ? String(p.stockQty) : '',
      reorderLevel: p.reorderLevel != null ? String(p.reorderLevel) : '',
    });
    setErrors({});
    setModal({ type: 'edit-accessory', product: p });
  }

  function validateProductForm(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!productForm.categoryId) errs.categoryId = 'Category is required.';

    const selectedCategory = categories.find((c) => c.id === productForm.categoryId);
    const isSerializedCategory = selectedCategory?.isSerialized ?? false;

    if (!isSerializedCategory) {
      if (!productForm.name.trim()) errs.name = 'Product name is required.';
      if (!productForm.sku.trim()) errs.sku = 'SKU is required.';
      const qty = Number(productForm.quantity);
      if (!productForm.quantity.trim() || !Number.isInteger(qty) || qty < 1) {
        errs.quantity = 'Total Stock must be a whole number of at least 1.';
      }
      if (!productForm.costPrice.trim() || Number(productForm.costPrice) < 0) {
        errs.costPrice = 'Cost price is required.';
      }
      // Selling Price is optional here — it can be left blank and entered
      // later at the point of sale in POS. If a value was typed, it must
      // still be a valid positive number.
      if (productForm.salePrice.trim()) {
        const sale = Number(productForm.salePrice);
        if (Number.isNaN(sale) || sale <= 0) {
          errs.salePrice = 'Selling price must be greater than zero.';
        }
      }
      return errs;
    }

    // Serialized (IMEI-based) category — Category, Device Name, and every
    // generated Unit Card's own required fields. SKU is auto-generated (no
    // longer a field the admin fills in), so it's never validated here.
    if (!productForm.modelName.trim()) errs.modelName = 'Device Name is required.';

    const qty = productForm.units.length;
    if (qty < 1) {
      errs.quantity = 'Quantity must be a whole number of at least 1.';
    }

    // Every generated unit card validates independently — the exact same
    // rules the form has always enforced, just per-unit, and identical
    // whether there's one unit or many.
    const seen = new Set<string>();
    productForm.units.forEach((u, i) => {
      const val = u.imei.trim();
      if (!val) {
        errs[`unit${i}Imei`] = 'IMEI is required.';
      } else if (!/^\d{15}$/.test(val)) {
        errs[`unit${i}Imei`] = 'IMEI must contain exactly 15 digits.';
      } else if (seen.has(val)) {
        errs[`unit${i}Imei`] = 'Duplicate IMEI entered.';
      } else {
        seen.add(val);
      }

      if (!u.deviceCondition) {
        errs[`unit${i}Condition`] = 'Condition is required.';
      }

      if (u.batteryHealth.trim()) {
        const b = Number(u.batteryHealth);
        if (Number.isNaN(b) || b < 0 || b > 100) {
          errs[`unit${i}Battery`] = 'Battery Health must be between 0 and 100.';
        }
      }
      if (isAdmin && (!u.costPrice.trim() || Number(u.costPrice) < 0)) {
        errs[`unit${i}Cost`] = 'Cost price is required.';
      }
      // Selling Price is optional at add-time — entered later in POS.
      if (u.salePrice.trim()) {
        const sale = Number(u.salePrice);
        if (Number.isNaN(sale) || sale <= 0) {
          errs[`unit${i}Sale`] = 'Selling price must be greater than zero.';
        }
      }
    });

    return errs;
  }

  async function handleSubmitProduct(e: FormEvent) {
    e.preventDefault();
    const errs = validateProductForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);

    const selectedCategory = categories.find((c) => c.id === productForm.categoryId);

    try {
      if (!selectedCategory?.isSerialized) {
        await createProduct({
          categoryId: productForm.categoryId,
          name: productForm.name,
          sku: productForm.sku,
          barcode: productForm.barcode || undefined,
          costPrice: Number(productForm.costPrice),
          salePrice: productForm.salePrice.trim() ? Number(productForm.salePrice) : undefined,
          stockQty: productForm.quantity ? Number(productForm.quantity) : 0,
          reorderLevel: productForm.reorderLevel ? Number(productForm.reorderLevel) : 0,
          color: productForm.color || undefined,
          compatibility: productForm.compatibility || undefined,
        });
        showToast('success', 'Accessory added successfully.');
      } else {
        const modelId = await resolveModelId(productForm.categoryId, productForm.modelName);
        const qty = productForm.units.length;
        const first = productForm.units[0];
        const isApple = !!isAppleCategory(selectedCategory?.name ?? '');
        const firstRamStorage = splitRamStorage(first.storage, isApple);

        // Every DTO field the backend needs comes from the unit cards — Unit
        // 1's own values become the shared/primary fields, Units 2..N travel
        // as unitOverrides (aligned to additionalImeis). SKU is required by
        // the backend (unique per business) but isn't a field the admin fills
        // in anymore — it's generated silently from the Device Name, the same
        // "silent find-or-create" spirit already used for Model.
        await createPhone({
          categoryId: productForm.categoryId,
          modelId,
          sku: generateSku(productForm.modelName),
          imei1: first.imei.trim() || undefined,
          quantity: qty > 1 ? qty : undefined,
          additionalImeis: productForm.units.slice(1).map((u) => u.imei.trim()),
          unitOverrides: [
            {},
            ...productForm.units.slice(1).map((u) => buildUnitOverridePayload(u, isApple)),
          ],
          color: first.color.trim() || undefined,
          ram: firstRamStorage.ram,
          storage: firstRamStorage.storage,
          deviceCondition: first.deviceCondition || undefined,
          ptaStatus: first.ptaStatus || undefined,
          conditionGrade: first.conditionGrade ? Number(first.conditionGrade) : undefined,
          batteryHealth: first.batteryHealth ? Number(first.batteryHealth) : undefined,
          costPrice: Number(first.costPrice || 0),
          salePrice: first.salePrice.trim() ? Number(first.salePrice) : undefined,
          supplier: productForm.supplier || undefined,
          notes: productForm.notes || undefined,
          warrantyDays: productForm.warrantyDays ? Number(productForm.warrantyDays) : undefined,
          boxIncluded: productForm.boxIncluded,
          chargerIncluded: productForm.chargerIncluded,
        });
        showToast(
          'success',
          qty > 1 ? `${qty} units added to inventory.` : 'Product added to inventory.',
        );
      }
      closeModal();
      await refreshAfterChange();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (/imei/i.test(err.message)) {
          setErrors((prev) => ({ ...prev, unit0Imei: err.message }));
        } else if (/sku/i.test(err.message)) {
          if (selectedCategory?.isSerialized) {
            // SKU is auto-generated and hidden for phones — a collision here
            // is effectively never (timestamp + random suffix), so there's no
            // field to attach it to; a retry with a fresh SKU always resolves it.
            showToast('error', 'Could not save — please try again.');
          } else {
            setErrors((prev) => ({ ...prev, sku: err.message }));
          }
        } else if (/model/i.test(err.message)) {
          setErrors((prev) => ({ ...prev, modelName: err.message }));
        } else {
          showToast('error', err.message);
        }
      } else {
        showToast('error', 'Could not save product. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function validatePhone(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!phoneForm.categoryId) errs.categoryId = 'Category is required.';
    if (!phoneForm.modelName.trim()) errs.modelName = 'Model name is required.';

    const imei = phoneForm.imei1.trim();
    if (!imei) {
      errs.imei1 = 'IMEI is required.';
    } else if (!/^\d{15}$/.test(imei)) {
      errs.imei1 = 'IMEI must contain 15 digits.';
    }

    if (phoneForm.batteryHealth.trim()) {
      const b = Number(phoneForm.batteryHealth);
      if (Number.isNaN(b) || b < 0 || b > 100) {
        errs.batteryHealth = 'Battery health must be between 0 and 100.';
      }
    }

    // Selling Price is optional — can be left blank and set later at POS.
    if (phoneForm.salePrice.trim()) {
      const sale = Number(phoneForm.salePrice);
      if (Number.isNaN(sale) || sale <= 0) {
        errs.salePrice = 'Selling price must be greater than zero.';
      }
    }

    return errs;
  }

  async function handleSubmitEditPhone(e: FormEvent) {
    e.preventDefault();
    if (modal.type !== 'edit-phone') return;
    const errs = validatePhone();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    const finalStorage =
      phoneForm.storage === 'CUSTOM' ? phoneForm.customStorage.trim() : phoneForm.storage;
    const finalColor = phoneForm.color.trim();

    try {
      const soldLocked = modal.unit.status === 'SOLD';
      const modelId = await resolveModelId(phoneForm.categoryId, phoneForm.modelName);
      await Promise.all([
        updateProduct(modal.unit.productId, {
          storage: finalStorage || undefined,
          categoryId: phoneForm.categoryId,
          modelId,
        }),
        updateProductUnit(modal.unit.id, {
          imei1: soldLocked ? undefined : phoneForm.imei1.trim() || undefined,
          serialNumber: soldLocked ? undefined : phoneForm.serialNumber.trim() || undefined,
          ram: phoneForm.ram || undefined,
          color: finalColor || undefined,
          ptaStatus: phoneForm.ptaStatus ? (phoneForm.ptaStatus as PtaStatus) : undefined,
          deviceCondition: phoneForm.deviceCondition,
          conditionGrade: phoneForm.conditionGrade ? Number(phoneForm.conditionGrade) : undefined,
          batteryHealth: phoneForm.batteryHealth ? Number(phoneForm.batteryHealth) : undefined,
          // costPrice qasdan yahan nahi bhejte — locked after creation
          salePrice: phoneForm.salePrice.trim() ? Number(phoneForm.salePrice) : undefined,
          supplier: phoneForm.supplier || undefined,
          notes: phoneForm.notes || undefined,
          warrantyDays: phoneForm.warrantyDays ? Number(phoneForm.warrantyDays) : undefined,
          boxIncluded: phoneForm.boxIncluded,
          chargerIncluded: phoneForm.chargerIncluded,
        }),
      ]);
      showToast('success', 'Product updated successfully.');
      closeModal();
      await refreshAfterChange();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        showToast('error', err.message);
      } else {
        showToast('error', 'Could not save phone. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function validateAccessory(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!accessoryForm.name.trim()) errs.name = 'Product name is required.';
    if (!accessoryForm.categoryId) errs.categoryId = 'Category is required.';
    // Selling Price is optional — can be left blank and set later at POS.
    if (accessoryForm.salePrice.trim()) {
      const sale = Number(accessoryForm.salePrice);
      if (Number.isNaN(sale) || sale <= 0) {
        errs.salePrice = 'Selling price must be greater than zero.';
      }
    }
    return errs;
  }

  async function handleSubmitEditAccessory(e: FormEvent) {
    e.preventDefault();
    if (modal.type !== 'edit-accessory') return;
    const errs = validateAccessory();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      // costPrice qasdan yahan nahi bhejte — locked after creation
      await updateProduct(modal.product.id, {
        name: accessoryForm.name,
        barcode: accessoryForm.barcode || undefined,
        color: accessoryForm.color || undefined,
        compatibility: accessoryForm.compatibility || undefined,
        salePrice: accessoryForm.salePrice.trim() ? Number(accessoryForm.salePrice) : undefined,
        categoryId: accessoryForm.categoryId,
        stockQty: accessoryForm.stockQty ? Number(accessoryForm.stockQty) : 0,
        reorderLevel: accessoryForm.reorderLevel ? Number(accessoryForm.reorderLevel) : 0,
      });
      showToast('success', 'Product updated successfully.');
      closeModal();
      await refreshAfterChange();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        showToast('error', err.message);
      } else {
        showToast('error', 'Could not update product. Review the highlighted fields.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (
      modal.type !== 'confirm-delete-phone' &&
      modal.type !== 'confirm-delete-accessory' &&
      modal.type !== 'confirm-delete-product'
    ) {
      return;
    }
    setSaving(true);
    try {
      const productId =
        modal.type === 'confirm-delete-phone'
          ? modal.unit.productId
          : modal.type === 'confirm-delete-accessory'
            ? modal.product.id
            : modal.productId;
      const result = await deleteProduct(productId);
      showToast('success', result.message);
      closeModal();
      await refreshAfterChange();
    } catch (err) {
      showToast('error', err instanceof ApiRequestError ? err.message : 'Could not delete product.');
    } finally {
      setSaving(false);
    }
  }

  // Table row actions fetch the one product on demand (never the whole
  // catalogue) and route into the exact same modals that already exist.
  async function handleViewClick(item: CatalogItem) {
    setRowActionId(item.id);
    try {
      const full = await getProduct(item.id);
      if (!full.isSerialized) {
        setModal({ type: 'view-accessory', product: full });
        return;
      }
      const productUnits = full.units ?? [];
      if (productUnits.length <= 1) {
        const unit = productUnits[0];
        if (!unit) {
          showToast('error', 'This product has no unit on record.');
          return;
        }
        setModal({ type: 'view-phone', unit: { ...unit, product: full } });
        return;
      }
      setUnitsSearch('');
      setUnitsConditionFilter('');
      setUnitsPtaFilter('');
      setUnitsStatusFilter('');
      setModal({ type: 'view-product-units', product: { ...full, units: productUnits } });
    } catch (err) {
      showToast('error', err instanceof ApiRequestError ? err.message : 'Could not load product.');
    } finally {
      setRowActionId(null);
    }
  }

  async function handleEditClick(item: CatalogItem) {
    setRowActionId(item.id);
    try {
      const full = await getProduct(item.id);
      if (!full.isSerialized) {
        openEditAccessory(full);
        return;
      }
      const productUnits = full.units ?? [];
      if (productUnits.length <= 1) {
        const unit = productUnits[0];
        if (!unit) {
          showToast('error', 'This product has no unit on record.');
          return;
        }
        openEditPhone({ ...unit, product: full });
        return;
      }
      // Multiple units share this product — pick which one to edit first.
      setModal({ type: 'view-product-units', product: { ...full, units: productUnits } });
    } catch (err) {
      showToast('error', err instanceof ApiRequestError ? err.message : 'Could not load product.');
    } finally {
      setRowActionId(null);
    }
  }

  function handleDeleteClick(item: CatalogItem) {
    setModal({ type: 'confirm-delete-product', productId: item.id, name: item.name });
  }

  const items = catalog?.items ?? [];
  const totalPages = catalog?.totalPages ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Products"
          subtitle="Search, filter, and manage your full catalogue"
          actions={
            isAdmin ? (
              <>
                <button type="button" onClick={openAddProduct} className={primaryButtonClass}>
                  <PlusIcon className="h-4 w-4" />
                  Add New Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvFile(null);
                    setCsvResult(null);
                    setShowCsvImport(true);
                  }}
                  className={secondaryButtonClass}
                >
                  Import CSV
                </button>
                <Link href="/categories" className={secondaryButtonClass}>
                  Manage Categories
                </Link>
              </>
            ) : undefined
          }
        />

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Summary stats — compact, so the table starts higher on the page */}
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CompactStatCard
            label="Total Active Products"
            value={counts ? formatNumber(counts.all) : '—'}
            icon={PackageIcon}
            color="bg-slate-100 text-slate-600"
          />
          <CompactStatCard
            label="Total Available Units"
            value={counts ? formatNumber(counts.totalAvailableUnits) : '—'}
            icon={BoxesIcon}
            color="bg-emerald-50 text-emerald-600"
          />
          <CompactStatCard
            label="Low Stock Count"
            value={counts ? formatNumber(counts.lowStockCount) : '—'}
            icon={AlertTriangleIcon}
            color="bg-amber-50 text-amber-600"
          />
        </div>

        {/* Search */}
        <div className="mb-3">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by product, model, category, SKU, IMEI, or serial number..."
          />
        </div>

        {/* Product table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {catalogLoading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No products found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-250 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Product</th>
                    <th className="px-5 py-3.5 font-medium">Category</th>
                    <th className="px-5 py-3.5 font-medium">Model</th>
                    <th className="px-5 py-3.5 font-medium">SKU</th>
                    <th className="px-5 py-3.5 font-medium">Stock</th>
                    <th className="px-5 py-3.5 font-medium">Condition</th>
                    <th className="px-5 py-3.5 font-medium">Sale Price</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                            {item.isSerialized ? (
                              <SmartphoneIcon className="h-5 w-5" />
                            ) : (
                              <PackageIcon className="h-5 w-5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-base font-semibold text-slate-900">{item.name}</div>
                            {unitSummaryText(item) && (
                              <div className="mt-1 text-xs text-slate-500">{unitSummaryText(item)}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{item.category?.name ?? '—'}</td>
                      <td className="px-5 py-4 text-slate-500">{item.model?.name ?? '—'}</td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">{item.sku}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">{formatNumber(item.stock)}</td>
                      <td className="px-5 py-4 text-slate-500">
                        {item.mixedConditions ? (
                          <StatusBadge tone="neutral">Mixed</StatusBadge>
                        ) : (
                          conditionLabel(item.condition)
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {item.salePrice != null ? (
                          <PriceDisplay value={item.salePrice} size="lg" />
                        ) : (
                          <span className="text-sm text-slate-400">Not set</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={item.status === 'LOW_STOCK' ? 'danger' : 'success'}>
                          {item.status === 'LOW_STOCK' ? 'Low Stock' : 'In Stock'}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <ActionMenu
                          actions={[
                            {
                              label: item.isSerialized && item.stock > 1 ? 'View Units' : 'View',
                              icon: EyeIcon,
                              variant: 'view',
                              disabled: rowActionId === item.id,
                              onClick: () => handleViewClick(item),
                            },
                            ...(isAdmin
                              ? [
                                  {
                                    label: 'Edit',
                                    icon: PencilIcon,
                                    variant: 'edit' as const,
                                    disabled: rowActionId === item.id,
                                    onClick: () => handleEditClick(item),
                                  },
                                  {
                                    label: 'Delete',
                                    icon: Trash2Icon,
                                    variant: 'delete' as const,
                                    onClick: () => handleDeleteClick(item),
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

        {/* Pagination */}
        {!catalogLoading && items.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Page {catalog?.page ?? 1} of {Math.max(totalPages, 1)} · {formatNumber(catalog?.total ?? 0)} products
              </span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-100"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!catalog?.hasPreviousPage}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => (catalog?.hasNextPage ? p + 1 : p))}
                disabled={!catalog?.hasNextPage}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add New Product modal */}
      {modal.type === 'add-product' && (
        <Modal
          title="Add New Product"
          onClose={closeModal}
          size="xl"
          footer={
            <div className="flex gap-2">
              <button
                type="submit"
                form="add-product-form"
                disabled={saving || !productForm.categoryId}
                className={primaryButtonClass}
              >
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Product'}
              </button>
              <button type="button" onClick={closeModal} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          }
        >
          <form id="add-product-form" onSubmit={handleSubmitProduct}>
            <div className="mb-6">
              <label className={labelClass}>
                Category <span className="text-red-500">*</span>
              </label>
              <p className="-mt-1 mb-3 text-xs text-slate-500">
                Choose which category this product belongs to.
              </p>
              {activeCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No categories are available. Please create a category from the Category
                  Terminal first.
                  <div className="mt-2">
                    <Link
                      href="/categories"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Manage Categories →
                    </Link>
                  </div>
                </div>
              ) : (
                <CategoryCardGrid
                  categories={activeCategories}
                  value={productForm.categoryId}
                  onChange={(id) => updateProductField('categoryId', id)}
                />
              )}
              {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
            </div>

            {(() => {
              const selectedCategory = categories.find((c) => c.id === productForm.categoryId);
              const isSerializedCategory = selectedCategory?.isSerialized ?? false;

              if (!productForm.categoryId) return null;

              return isSerializedCategory ? (
                <>
                  {/* Quantity — governs how many Product Unit cards get
                      generated further down the form. Lives directly under
                      Category, ahead of the shared product details. */}
                  <div className="mb-6">
                    <div className={formSectionTitleClass}>Quantity</div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <label className={labelClass}>
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <p className="mb-2 text-xs text-slate-500">
                        How many physical units are you adding right now? Above 1, each unit gets
                        its own full card to fill in separately.
                      </p>
                      <input
                        value={productForm.quantity}
                        onChange={(e) => updatePhoneQuantity(stripDecimalPoint(e.target.value))}
                        onKeyDown={blockDecimalKeyDown}
                        onPaste={blockDecimalPaste}
                        type="number"
                        min={1}
                        step={1}
                        placeholder="1"
                        className={`${inputClass} max-w-40`}
                      />
                      {errors.quantity && <p className={errorClass}>{errors.quantity}</p>}
                    </div>
                  </div>

                  {/* Device Name — the complete product name (e.g. "iPhone 13
                      128GB"). Feeds Model resolution directly; no separate
                      Brand/Model/Storage/SKU fields are shown since Category
                      already is the brand and this name already carries
                      storage. SKU is generated automatically at save time. */}
                  <div className="mb-6">
                    <div className={formSectionTitleClass}>Device Name</div>
                    <div>
                      <label className={labelClass}>
                        Device Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={productForm.modelName}
                        onChange={(e) => updateProductField('modelName', e.target.value)}
                        placeholder="e.g. iPhone 13 128GB"
                        className={inputClass}
                      />
                      {errors.modelName && <p className={errorClass}>{errors.modelName}</p>}
                    </div>
                  </div>

                  {/* Generated Product Unit Fields — one full card per
                      physical unit, always (even when Quantity is 1), so
                      Unit 1 is never structured differently from Unit N. */}
                  <div className="mb-6">
                    <div className={formSectionTitleClass}>
                      {productForm.units.length > 1 ? 'Generated Product Units' : 'Unit 1'}
                    </div>

                    {(() => {
                      const isApple = !!(selectedCategory && isAppleCategory(selectedCategory.name));
                      const completeCount = productForm.units.filter((u) => isUnitComplete(u, isAdmin)).length;

                      return (
                        <>
                          {productForm.units.length > 1 && (
                            <>
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                                <p className="text-xs text-slate-600">
                                  <span className="font-semibold text-slate-900">{completeCount}</span> of{' '}
                                  {productForm.units.length} units complete
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={expandAllUnits}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                  >
                                    Expand All Units
                                  </button>
                                  <button
                                    type="button"
                                    onClick={collapseAllUnits}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                  >
                                    Collapse All Units
                                  </button>
                                  <button
                                    type="button"
                                    onClick={copyCommonValuesToAllUnits}
                                    className="rounded-lg border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                                  >
                                    Copy Common Values to All Units
                                  </button>
                                </div>
                              </div>
                              <p className="-mt-1 mb-3 text-xs text-slate-500">
                                Copies Unit 1&apos;s Color/Condition/Storage/Grade/PTA Status/Cost/Sale
                                Price to every other unit. IMEI and Battery Health are never copied — edit any
                                unit afterwards to make it different again.
                              </p>
                            </>
                          )}

                          <div className="space-y-3">
                            {productForm.units.map((u, i) => (
                              <UnitCard
                                key={i}
                                index={i}
                                unit={u}
                                expanded={!!expandedUnits[i]}
                                onToggleExpand={() =>
                                  setExpandedUnits((prev) => ({ ...prev, [i]: !prev[i] }))
                                }
                                onChange={(key, value) => updateUnitField(i, key, value)}
                                isAdmin={isAdmin}
                                isApple={isApple}
                                errors={{
                                  imei: errors[`unit${i}Imei`],
                                  condition: errors[`unit${i}Condition`],
                                  battery: errors[`unit${i}Battery`],
                                  cost: errors[`unit${i}Cost`],
                                  sale: errors[`unit${i}Sale`],
                                }}
                              />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Section 4: Optional Details (collapsible) */}
                  <div className="mb-2 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setOptionalOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
                    >
                      Optional Details
                      <ChevronDownIcon
                        className={`h-4 w-4 text-slate-400 transition-transform ${optionalOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {optionalOpen && (
                      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                        <input
                          value={productForm.supplier}
                          onChange={(e) => updateProductField('supplier', e.target.value)}
                          placeholder="Supplier"
                          className={inputClass}
                        />
                        <input
                          value={productForm.warrantyDays}
                          onChange={(e) =>
                            updateProductField('warrantyDays', stripDecimalPoint(e.target.value))
                          }
                          onKeyDown={blockDecimalKeyDown}
                          onPaste={blockDecimalPaste}
                          type="number"
                          min={0}
                          placeholder="Warranty (days)"
                          className={inputClass}
                        />
                        <input
                          value={productForm.notes}
                          onChange={(e) => updateProductField('notes', e.target.value)}
                          placeholder="Notes"
                          className={`${inputClass} sm:col-span-2`}
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={productForm.boxIncluded}
                            onChange={(e) => updateProductField('boxIncluded', e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Box included
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={productForm.chargerIncluded}
                            onChange={(e) => updateProductField('chargerIncluded', e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Charger included
                        </label>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <div className={formSectionTitleClass}>Product Information</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>
                          Model <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={productForm.name}
                          onChange={(e) => updateProductField('name', e.target.value)}
                          placeholder="e.g. Fast Charger 20W"
                          className={inputClass}
                        />
                        {errors.name && <p className={errorClass}>{errors.name}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>
                          SKU <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={productForm.sku}
                          onChange={(e) => updateProductField('sku', e.target.value)}
                          className={inputClass}
                        />
                        {errors.sku && <p className={errorClass}>{errors.sku}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>
                          Total Stock / Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={productForm.quantity}
                          onChange={(e) =>
                            updateProductField('quantity', stripDecimalPoint(e.target.value))
                          }
                          onKeyDown={blockDecimalKeyDown}
                          onPaste={blockDecimalPaste}
                          type="number"
                          min={1}
                          step={1}
                          placeholder="e.g. 20"
                          className={inputClass}
                        />
                        {errors.quantity && <p className={errorClass}>{errors.quantity}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Color (optional)</label>
                        <ComboField
                          value={productForm.color}
                          onChange={(v) => updateProductField('color', v)}
                          options={COLOR_OPTIONS}
                          customLabel="Other / Custom Color"
                          customPlaceholder="Enter Custom Color"
                          placeholder="Search color..."
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Compatibility (optional)</label>
                        <input
                          value={productForm.compatibility}
                          onChange={(e) => updateProductField('compatibility', e.target.value)}
                          placeholder="e.g. iPhone 12-15"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className={formSectionTitleClass}>Pricing</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {isAdmin && (
                        <div>
                          <label className={labelClass}>
                            Cost Price <span className="text-red-500">*</span>
                          </label>
                          <input
                            value={productForm.costPrice}
                            onChange={(e) =>
                              updateProductField('costPrice', stripDecimalPoint(e.target.value))
                            }
                            onKeyDown={blockDecimalKeyDown}
                            onPaste={blockDecimalPaste}
                            type="number"
                            step="1"
                            className={inputClass}
                          />
                          {errors.costPrice && <p className={errorClass}>{errors.costPrice}</p>}
                        </div>
                      )}
                      <div>
                        <label className={labelClass}>
                          Selling Price{' '}
                          <span className="text-slate-400">(optional — can be set at POS)</span>
                        </label>
                        <input
                          value={productForm.salePrice}
                          onChange={(e) =>
                            updateProductField('salePrice', stripDecimalPoint(e.target.value))
                          }
                          onKeyDown={blockDecimalKeyDown}
                          onPaste={blockDecimalPaste}
                          type="number"
                          step="1"
                          className={inputClass}
                        />
                        {errors.salePrice && <p className={errorClass}>{errors.salePrice}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="mb-2 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setOptionalOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
                    >
                      Optional Details
                      <ChevronDownIcon
                        className={`h-4 w-4 text-slate-400 transition-transform ${optionalOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {optionalOpen && (
                      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                        <input
                          value={productForm.barcode}
                          onChange={(e) => updateProductField('barcode', e.target.value)}
                          placeholder="Barcode"
                          className={inputClass}
                        />
                        <input
                          value={productForm.reorderLevel}
                          onChange={(e) =>
                            updateProductField('reorderLevel', stripDecimalPoint(e.target.value))
                          }
                          onKeyDown={blockDecimalKeyDown}
                          onPaste={blockDecimalPaste}
                          type="number"
                          min={0}
                          placeholder="Stock Alert At"
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </form>
        </Modal>
      )}

      {/* Edit Phone modal */}
      {modal.type === 'edit-phone' && (
        <Modal
          title="Edit Phone"
          onClose={closeModal}
          size="lg"
          footer={
            <div className="flex gap-2">
              <button type="submit" form="edit-phone-form" disabled={saving} className={primaryButtonClass}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Update Product'}
              </button>
              <button type="button" onClick={closeModal} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          }
        >
          <form id="edit-phone-form" onSubmit={handleSubmitEditPhone}>
            <div className="mb-6">
              <div className={formSectionTitleClass}>Device Information</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Category <span className="text-red-500">*</span>
                  </label>
                  <CategoryPicker
                    categories={categoryOptionsForEdit(true, phoneForm.categoryId)}
                    value={phoneForm.categoryId}
                    onChange={(id) => updatePhoneField('categoryId', id)}
                    allowClear={false}
                  />
                  {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
                </div>
                <div>
                  <label className={labelClass}>
                    Model Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={phoneForm.modelName}
                    onChange={(e) => updatePhoneField('modelName', e.target.value)}
                    placeholder="e.g. Galaxy S24 Ultra"
                    className={inputClass}
                  />
                  {errors.modelName && <p className={errorClass}>{errors.modelName}</p>}
                </div>
                <div>
                  <label className={labelClass}>RAM (optional)</label>
                  <input
                    value={phoneForm.ram}
                    onChange={(e) => updatePhoneField('ram', e.target.value)}
                    placeholder="e.g. 8GB"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Storage (optional)</label>
                  <select
                    value={phoneForm.storage}
                    onChange={(e) => updatePhoneField('storage', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select storage</option>
                    {STORAGE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="CUSTOM">Custom / Other</option>
                  </select>
                  {phoneForm.storage === 'CUSTOM' && (
                    <input
                      value={phoneForm.customStorage}
                      onChange={(e) => updatePhoneField('customStorage', e.target.value)}
                      placeholder="Enter custom storage (e.g. 2TB)"
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>Color (optional)</label>
                  <ComboField
                    value={phoneForm.color}
                    onChange={(v) => updatePhoneField('color', v)}
                    options={COLOR_OPTIONS}
                    customLabel="Other / Custom Color"
                    customPlaceholder="Enter Custom Color"
                    placeholder="Search color..."
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className={formSectionTitleClass}>Device Identity &amp; Condition</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    IMEI <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={phoneForm.imei1}
                    onChange={(e) =>
                      updatePhoneField('imei1', e.target.value.replace(/[^0-9]/g, '').slice(0, 15))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    inputMode="numeric"
                    maxLength={15}
                    disabled={modal.unit.status === 'SOLD'}
                    className={`${inputClass} font-mono`}
                  />
                  {errors.imei1 && <p className={errorClass}>{errors.imei1}</p>}
                </div>
                <div>
                  <label className={labelClass}>IMEI 2 (optional, dual SIM)</label>
                  <input
                    value={phoneForm.imei2}
                    onChange={(e) =>
                      updatePhoneField('imei2', e.target.value.replace(/[^0-9]/g, '').slice(0, 15))
                    }
                    inputMode="numeric"
                    maxLength={15}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Serial Number (optional)</label>
                  <input
                    value={phoneForm.serialNumber}
                    onChange={(e) => updatePhoneField('serialNumber', e.target.value)}
                    placeholder="Device serial number"
                    disabled={modal.unit.status === 'SOLD'}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>PTA Status (optional)</label>
                  <SegmentedControl
                    options={PTA_OPTIONS}
                    value={phoneForm.ptaStatus}
                    onChange={(v) => updatePhoneField('ptaStatus', v as PtaStatus | '')}
                    allowAll
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Device Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={phoneForm.deviceCondition}
                    onChange={(e) =>
                      updatePhoneField('deviceCondition', e.target.value as DeviceCondition)
                    }
                    className={inputClass}
                  >
                    {CONDITION_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Condition Grade (optional)</label>
                  <select
                    value={phoneForm.conditionGrade}
                    onChange={(e) => updatePhoneField('conditionGrade', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not rated</option>
                    {CONDITION_GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}/10
                      </option>
                    ))}
                  </select>
                </div>
                {isAppleCategory(categories.find((c) => c.id === phoneForm.categoryId)?.name ?? '') && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Battery Health <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="relative max-w-50">
                    <input
                      value={phoneForm.batteryHealth}
                      onChange={(e) =>
                        updatePhoneField('batteryHealth', stripDecimalPoint(e.target.value))
                      }
                      onKeyDown={blockDecimalKeyDown}
                      onPaste={blockDecimalPaste}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 92"
                      className={`${inputClass} pr-8`}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      %
                    </span>
                  </div>
                  {errors.batteryHealth && <p className={errorClass}>{errors.batteryHealth}</p>}
                </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <div className={formSectionTitleClass}>Pricing</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {isAdmin && (
                  <div>
                    <label className={labelClass}>Cost Price</label>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
                      {phoneForm.costPrice ? formatCurrency(phoneForm.costPrice) : '—'}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Fixed at creation — not editable here.
                    </p>
                  </div>
                )}
                <div>
                  <label className={labelClass}>
                    Selling Price <span className="text-slate-400">(optional — can be set at POS)</span>
                  </label>
                  <input
                    value={phoneForm.salePrice}
                    onChange={(e) =>
                      updatePhoneField('salePrice', stripDecimalPoint(e.target.value))
                    }
                    onKeyDown={blockDecimalKeyDown}
                    onPaste={blockDecimalPaste}
                    type="number"
                    step="1"
                    className={inputClass}
                  />
                  {errors.salePrice && <p className={errorClass}>{errors.salePrice}</p>}
                  {!errors.salePrice &&
                    phoneForm.costPrice &&
                    phoneForm.salePrice &&
                    Number(phoneForm.salePrice) < Number(phoneForm.costPrice) && (
                      <p className="mt-1 text-xs text-amber-600">
                        Selling price is below cost price.
                      </p>
                    )}
                </div>
              </div>
            </div>

            <div className="mb-2 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setOptionalOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
              >
                Optional Details
                <ChevronDownIcon
                  className={`h-4 w-4 text-slate-400 transition-transform ${optionalOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {optionalOpen && (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                  <input
                    value={phoneForm.supplier}
                    onChange={(e) => updatePhoneField('supplier', e.target.value)}
                    placeholder="Supplier"
                    className={inputClass}
                  />
                  <input
                    value={phoneForm.warrantyDays}
                    onChange={(e) =>
                      updatePhoneField('warrantyDays', stripDecimalPoint(e.target.value))
                    }
                    onKeyDown={blockDecimalKeyDown}
                    onPaste={blockDecimalPaste}
                    type="number"
                    min={0}
                    placeholder="Warranty (days)"
                    className={inputClass}
                  />
                  <input
                    value={phoneForm.notes}
                    onChange={(e) => updatePhoneField('notes', e.target.value)}
                    placeholder="Notes"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={phoneForm.boxIncluded}
                      onChange={(e) => updatePhoneField('boxIncluded', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Box included
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={phoneForm.chargerIncluded}
                      onChange={(e) => updatePhoneField('chargerIncluded', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Charger included
                  </label>
                </div>
              )}
            </div>

          </form>
        </Modal>
      )}

      {/* Edit Accessory modal */}
      {modal.type === 'edit-accessory' && (
        <Modal
          title="Edit Accessory"
          onClose={closeModal}
          size="md"
          footer={
            <div className="flex gap-2">
              <button type="submit" form="edit-accessory-form" disabled={saving} className={primaryButtonClass}>
                {saving && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Update Product'}
              </button>
              <button type="button" onClick={closeModal} disabled={saving} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          }
        >
          <form id="edit-accessory-form" onSubmit={handleSubmitEditAccessory}>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={labelClass}>
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  value={accessoryForm.name}
                  onChange={(e) => updateAccessoryField('name', e.target.value)}
                  className={inputClass}
                />
                {errors.name && <p className={errorClass}>{errors.name}</p>}
              </div>
              <div>
                <label className={labelClass}>
                  Category <span className="text-red-500">*</span>
                </label>
                <CategoryPicker
                  categories={categoryOptionsForEdit(false, accessoryForm.categoryId)}
                  value={accessoryForm.categoryId}
                  onChange={(id) => updateAccessoryField('categoryId', id)}
                  allowClear={false}
                />
                {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
              </div>
              <div>
                <label className={labelClass}>Barcode</label>
                <input
                  value={accessoryForm.barcode}
                  onChange={(e) => updateAccessoryField('barcode', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Color</label>
                  <ComboField
                    value={accessoryForm.color}
                    onChange={(v) => updateAccessoryField('color', v)}
                    options={COLOR_OPTIONS}
                    customLabel="Other / Custom Color"
                    customPlaceholder="Enter Custom Color"
                    placeholder="Search color..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Compatibility</label>
                  <input
                    value={accessoryForm.compatibility}
                    onChange={(e) => updateAccessoryField('compatibility', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {isAdmin && (
                  <div>
                    <label className={labelClass}>Cost Price</label>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
                      {accessoryForm.costPrice ? formatCurrency(accessoryForm.costPrice) : '—'}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Fixed at creation — not editable here.
                    </p>
                  </div>
                )}
                <div>
                  <label className={labelClass}>
                    Selling Price <span className="text-slate-400">(optional — can be set at POS)</span>
                  </label>
                  <input
                    value={accessoryForm.salePrice}
                    onChange={(e) =>
                      updateAccessoryField('salePrice', stripDecimalPoint(e.target.value))
                    }
                    onKeyDown={blockDecimalKeyDown}
                    onPaste={blockDecimalPaste}
                    type="number"
                    step="1"
                    className={inputClass}
                  />
                  {errors.salePrice && <p className={errorClass}>{errors.salePrice}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Stock Qty</label>
                  <input
                    value={accessoryForm.stockQty}
                    onChange={(e) =>
                      updateAccessoryField('stockQty', stripDecimalPoint(e.target.value))
                    }
                    onKeyDown={blockDecimalKeyDown}
                    onPaste={blockDecimalPaste}
                    type="number"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stock Alert At</label>
                  <input
                    value={accessoryForm.reorderLevel}
                    onChange={(e) =>
                      updateAccessoryField('reorderLevel', stripDecimalPoint(e.target.value))
                    }
                    onKeyDown={blockDecimalKeyDown}
                    onPaste={blockDecimalPaste}
                    type="number"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

          </form>
        </Modal>
      )}

      {/* View phone modal */}
      {modal.type === 'view-phone' && (
        <Modal
          title="Phone Details"
          onClose={closeModal}
          size="lg"
          headerExtra={
            <StatusBadge tone={unitStatusTone(modal.unit.status)} dot>
              {unitStatusLabel(modal.unit.status)}
            </StatusBadge>
          }
        >
          <DetailSection title="Device Identity">
            <DetailItem label="Category" value={modal.unit.product?.category?.name ?? '—'} />
            <DetailItem label="Model" value={modal.unit.product?.model?.name ?? '—'} />
            <DetailItem label="SKU" value={modal.unit.product?.sku ?? '—'} />
            <DetailItem label="IMEI" value={modal.unit.imei1 ?? '—'} />
          </DetailSection>
          <DetailSection title="Specifications & Condition">
            <DetailItem label="RAM" value={modal.unit.ram ?? '—'} />
            <DetailItem label="Storage" value={modal.unit.product?.storage ?? '—'} />
            <DetailItem label="Color" value={modal.unit.color ?? '—'} />
            <DetailItem label="Condition" value={conditionLabel(modal.unit.deviceCondition)} />
            <DetailItem label="Device Status" value={ptaLabel(modal.unit.ptaStatus)} />
            <DetailItem
              label="Battery Health"
              value={modal.unit.batteryHealth != null ? `${modal.unit.batteryHealth}%` : '—'}
            />
          </DetailSection>
          <DetailSection title="Pricing & Stock">
            {isAdmin && (
              <DetailItem
                label="Cost Price"
                value={modal.unit.costPrice != null ? formatCurrency(modal.unit.costPrice) : '—'}
              />
            )}
            <DetailItem
              label="Selling Price"
              value={modal.unit.salePrice != null ? formatCurrency(modal.unit.salePrice) : '—'}
            />
            <DetailItem label="Stock Status" value={modal.unit.status.replace('_', ' ')} />
          </DetailSection>
          <DetailSection title="Other">
            <DetailItem
              label="Created Date"
              value={new Date(modal.unit.createdAt).toLocaleDateString()}
            />
            <DetailItem label="Supplier" value={modal.unit.supplier ?? '—'} />
            <DetailItem label="Notes" value={modal.unit.notes ?? '—'} className="sm:col-span-2" />
          </DetailSection>
        </Modal>
      )}

      {/* View accessory modal */}
      {modal.type === 'view-accessory' && (
        <Modal
          title="Product Details"
          onClose={closeModal}
          size="lg"
          headerExtra={
            <StatusBadge
              tone={modal.product.stockQty <= modal.product.reorderLevel ? 'danger' : 'success'}
              dot
            >
              {modal.product.stockQty <= modal.product.reorderLevel ? 'Low Stock' : 'In Stock'}
            </StatusBadge>
          }
        >
          <DetailSection title="Product Identity">
            <DetailItem label="Model" value={modal.product.name} />
            <DetailItem label="Category" value={modal.product.category?.name ?? '—'} />
            <DetailItem label="SKU" value={modal.product.sku} />
            <DetailItem label="Barcode" value={modal.product.barcode ?? '—'} />
            <DetailItem label="Color" value={modal.product.color ?? '—'} />
            <DetailItem label="Compatibility" value={modal.product.compatibility ?? '—'} />
          </DetailSection>
          <DetailSection title="Pricing & Stock">
            {isAdmin && (
              <DetailItem
                label="Cost Price"
                value={modal.product.costPrice != null ? formatCurrency(modal.product.costPrice) : '—'}
              />
            )}
            <DetailItem
              label="Selling Price"
              value={modal.product.salePrice != null ? formatCurrency(modal.product.salePrice) : '—'}
            />
            <DetailItem label="Stock Qty" value={formatNumber(modal.product.stockQty)} />
            <DetailItem label="Stock Alert At" value={formatNumber(modal.product.reorderLevel)} />
          </DetailSection>
          <DetailSection title="Other">
            <DetailItem
              label="Created Date"
              value={new Date(modal.product.createdAt).toLocaleDateString()}
            />
          </DetailSection>
        </Modal>
      )}

      {/* CSV bulk import modal */}
      {showCsvImport && (
        <Modal
          title="Import Serialized Devices from CSV"
          onClose={() => {
            if (csvImporting) return;
            setShowCsvImport(false);
            setCsvFile(null);
            setCsvResult(null);
          }}
          size="lg"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!csvFile || csvImporting}
                onClick={async () => {
                  if (!csvFile) return;
                  setCsvImporting(true);
                  setCsvResult(null);
                  try {
                    const result = await importProductsCsv(csvFile);
                    setCsvResult(result);
                    if (result.imported > 0) await refreshAfterChange();
                    if (result.failed === 0) {
                      showToast('success', `Imported ${result.imported} of ${result.totalRows} rows.`);
                    }
                  } catch (err) {
                    showToast(
                      'error',
                      err instanceof ApiRequestError ? err.message : 'Could not import CSV file.',
                    );
                  } finally {
                    setCsvImporting(false);
                  }
                }}
                className={primaryButtonClass}
              >
                {csvImporting && <Loader2Icon className="h-4 w-4 animate-spin" />}
                {csvImporting ? 'Importing...' : 'Import'}
              </button>
              <button
                type="button"
                disabled={csvImporting}
                onClick={() => {
                  setShowCsvImport(false);
                  setCsvFile(null);
                  setCsvResult(null);
                }}
                className={secondaryButtonClass}
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Columns required, in order: <code className="text-xs">category, model, ram, storage,
              color, condition, ptaStatus, imei, serialNumber, batteryHealth, costPrice,
              defaultSellingPrice, quantity</code>. Either <code className="text-xs">imei</code> or{' '}
              <code className="text-xs">serialNumber</code> is required per row —{' '}
              <code className="text-xs">batteryHealth</code> may be left blank.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
            {csvResult && (
              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">
                    {csvResult.imported} imported · {csvResult.failed} failed · {csvResult.totalRows} total rows
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {csvResult.results.map((r) => (
                    <div
                      key={r.row}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                        r.status === 'error' ? 'text-red-700' : 'text-slate-500'
                      }`}
                    >
                      <span className="font-mono">#{r.row}</span>
                      <span>{r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Multi-unit serialized product — search/filter units, then view/edit one */}
      {modal.type === 'view-product-units' && (
        <ViewUnitsModal
          product={modal.product}
          search={unitsSearch}
          onSearchChange={setUnitsSearch}
          conditionFilter={unitsConditionFilter}
          onConditionFilterChange={setUnitsConditionFilter}
          ptaFilter={unitsPtaFilter}
          onPtaFilterChange={setUnitsPtaFilter}
          statusFilter={unitsStatusFilter}
          onStatusFilterChange={setUnitsStatusFilter}
          isAdmin={isAdmin}
          onClose={closeModal}
          onViewUnit={(u) => setModal({ type: 'view-phone', unit: { ...u, product: modal.product } })}
          onEditUnit={(u) => openEditPhone({ ...u, product: modal.product })}
        />
      )}

      {/* Delete confirmation */}
      {(modal.type === 'confirm-delete-phone' ||
        modal.type === 'confirm-delete-accessory' ||
        modal.type === 'confirm-delete-product') && (
        <ConfirmDialog
          title="Delete Product?"
          description="This product will be removed from active products. Products linked to sales or inventory history will be archived instead of permanently deleted."
          confirmLabel={saving ? 'Deleting...' : 'Delete Product'}
          variant="danger"
          loading={saving}
          onConfirm={confirmDelete}
          onCancel={closeModal}
        />
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}
