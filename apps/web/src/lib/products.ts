import { apiClient } from './api-client';
import { PtaStatus, DeviceCondition, ProductUnit } from './product-units';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  costPrice: string | null;
  // Optional — a product can be created with only a Cost Price; the actual
  // Selling Price is then entered at the point of sale in POS.
  salePrice: string | null;
  stockQty: number;
  reorderLevel: number;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string; isSerialized: boolean } | null;
  isSerialized: boolean;
  modelId: string | null;
  model: { id: string; name: string } | null;
  storage: string | null;
  color: string | null;
  compatibility: string | null;
  createdAt: string;
  // Serialized products only — count of this model's units currently
  // IN_STOCK. Undefined for accessories (use stockQty instead).
  availableUnits?: number;
}

export interface ProductCategoryCount {
  id: string | null;
  name: string;
  count: number;
}

export interface ProductCounts {
  all: number;
  categories: ProductCategoryCount[];
  totalAvailableUnits: number;
  lowStockCount: number;
}

// Products Page table row — one per Product. Stock is an aggregate: available
// IN_STOCK unit count for serialized products, stockQty for accessories.
export interface CatalogItem {
  id: string;
  name: string;
  sku: string;
  salePrice: string | null;
  isSerialized: boolean;
  createdAt: string;
  category: { id: string; name: string | null } | null;
  model: { id: string; name: string | null } | null;
  stock: number;
  condition: DeviceCondition | null;
  // Uniform-value fields — null when the product's in-stock units don't
  // all share the same color/condition (see mixedColors/mixedConditions).
  color: string | null;
  // True when this grouped product's IN_STOCK units don't all share the
  // same condition/color/PTA status — the row should show "Mixed"/"Multiple"
  // wording instead of a single value in that case.
  mixedConditions: boolean;
  mixedColors: boolean;
  mixedPta: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK';
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CatalogQuery {
  page?: number;
  limit?: 25 | 50 | 100;
  search?: string;
  categoryId?: string;
  condition?: DeviceCondition;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK';
  isSerialized?: boolean;
  sortBy?: 'createdAt' | 'name' | 'stock' | 'price';
  sortOrder?: 'asc' | 'desc';
  archived?: boolean;
}

// Accessories (non-serialized) ke liye — serialized phones sirf CreatePhoneInput se
export interface CreateProductInput {
  name: string;
  sku: string;
  barcode?: string;
  costPrice: number;
  // Optional — the product must be creatable with only a Cost Price; the
  // final Selling Price is entered later at the point of sale in POS.
  salePrice?: number;
  stockQty?: number;
  reorderLevel?: number;
  categoryId: string;
  color?: string;
  compatibility?: string;
}

// costPrice aur isSerialized qasdan yahan nahi — creation ke baad fix rehni chahiye
export interface UpdateProductInput {
  name?: string;
  barcode?: string;
  salePrice?: number;
  stockQty?: number;
  reorderLevel?: number;
  categoryId?: string;
  modelId?: string;
  storage?: string;
  color?: string;
  compatibility?: string;
}

// Per-unit attribute overrides for batch intake — aligned by index to
// [imei1, ...additionalImeis]. Any field left out falls back to the shared
// top-level value on CreatePhoneInput below.
export interface UnitOverride {
  color?: string;
  ram?: string;
  storage?: string;
  deviceCondition?: DeviceCondition;
  ptaStatus?: PtaStatus;
  batteryHealth?: number;
  conditionGrade?: number;
  costPrice?: number;
  salePrice?: number;
  notes?: string;
}

// Add Product (phone) — Category -> Model -> specs -> inventory -> pricing.
// name is derived server-side from the selected Model, never sent here.
export interface CreatePhoneInput {
  categoryId: string;
  modelId: string;
  sku: string;

  ram?: string;
  storage?: string;
  color?: string;
  // Optional — the Add Product form no longer collects a device condition
  // per unit; omitted, the backend's column default (BRAND_NEW) applies.
  deviceCondition?: DeviceCondition;
  ptaStatus?: PtaStatus;

  // IMEI is required — enforced server-side.
  imei1?: string;
  imei2?: string;
  serialNumber?: string;
  conditionGrade?: number;
  batteryHealth?: number;

  // Manual multi-unit intake — quantity 1 (default, omit this) behaves exactly
  // like a single-device add always has. quantity > 1 needs one extra real
  // IMEI per extra unit in additionalImeis (length === quantity - 1).
  quantity?: number;
  additionalImeis?: string[];
  // Aligned by index to [imei1, ...additionalImeis] — per-unit color/
  // condition/PTA/battery/price overrides for batch intake.
  unitOverrides?: UnitOverride[];

  costPrice: number;
  // Optional — final Selling Price is entered later at the point of sale in POS.
  salePrice?: number;

  supplier?: string;
  notes?: string;
  warrantyDays?: number;
  boxIncluded?: boolean;
  chargerIncluded?: boolean;
}

export interface DeleteProductResult {
  archived: boolean;
  message: string;
}

export interface CsvImportRowResult {
  row: number;
  status: 'created' | 'error';
  message: string;
}

export interface CsvImportResult {
  totalRows: number;
  imported: number;
  failed: number;
  results: CsvImportRowResult[];
}

export async function getProducts(options?: {
  includeArchived?: boolean;
  inStockOnly?: boolean;
}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (options?.includeArchived) params.set('includeArchived', 'true');
  if (options?.inStockOnly) params.set('inStockOnly', 'true');
  const query = params.toString();
  return apiClient.get<Product[]>(`/products${query ? `?${query}` : ''}`);
}

export async function getProductCounts(): Promise<ProductCounts> {
  return apiClient.get<ProductCounts>('/products/counts');
}

// Products Page table — server-side paginated/searched/filtered/sorted.
export async function getProductsCatalog(query: CatalogQuery): Promise<CatalogPage> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.condition) params.set('condition', query.condition);
  if (query.stockStatus) params.set('stockStatus', query.stockStatus);
  if (query.isSerialized !== undefined) params.set('isSerialized', String(query.isSerialized));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.archived) params.set('archived', 'true');
  return apiClient.get<CatalogPage>(`/products/catalog?${params.toString()}`);
}

// Single product (+ its units, if serialized) — powers the table's View/Edit
// actions without needing the full catalogue loaded client-side.
export async function getProduct(
  id: string,
): Promise<Product & { units?: ProductUnit[] }> {
  return apiClient.get<Product & { units?: ProductUnit[] }>(`/products/${id}`);
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  return apiClient.post<Product>('/products', input);
}

export async function createPhone(
  input: CreatePhoneInput,
): Promise<Product & { unit: ProductUnit }> {
  return apiClient.post<Product & { unit: ProductUnit }>(
    '/products/phones',
    input,
  );
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<Product> {
  return apiClient.patch<Product>(`/products/${id}`, input);
}

export async function deleteProduct(id: string): Promise<DeleteProductResult> {
  return apiClient.del<DeleteProductResult>(`/products/${id}`);
}

export async function importProductsCsv(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.postForm<CsvImportResult>('/products/csv-import', formData);
}
