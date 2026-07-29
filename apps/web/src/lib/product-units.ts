import { apiClient } from './api-client';

export type PtaStatus = 'PTA' | 'NON_PTA' | 'JV';
export type UnitStatus = 'IN_STOCK' | 'SOLD' | 'RESERVED';
export type DeviceCondition =
  | 'BRAND_NEW'
  // Sealed, box-packed device that has never been opened/used.
  | 'BRAND_NEW_PIN_PACK'
  | 'OPEN_BOX'
  | 'USED'
  | 'REFURBISHED'
  | 'CPO';

export interface ProductUnit {
  id: string;
  productId: string;
  // A device is identified by IMEI or Serial Number — at least one is always
  // present, enforced server-side, but neither is individually guaranteed.
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
  ram: string | null;
  storage: string | null;
  color: string | null;
  conditionGrade: number | null;
  batteryHealth: number | null;
  ptaStatus: PtaStatus | null;
  deviceCondition: DeviceCondition;
  isNew: boolean;
  faceIdWorking: boolean | null;
  screenOriginal: boolean | null;
  boxIncluded: boolean;
  chargerIncluded: boolean;
  warrantyDays: number;
  supplier: string | null;
  costPrice: string | null;
  // Optional at add-time — left null until the final price is entered at
  // the point of sale in POS.
  salePrice: string | null;
  status: UnitStatus;
  notes: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    model: { id: string; name: string } | null;
    storage: string | null;
    category: { id: string; name: string; isSerialized: boolean } | null;
    isActive: boolean;
  };
}

export interface CreateProductUnitInput {
  productId: string;
  imei1?: string;
  imei2?: string;
  serialNumber?: string;
  ram?: string;
  color?: string;
  deviceCondition: DeviceCondition;
  conditionGrade?: number;
  batteryHealth?: number;
  ptaStatus?: PtaStatus;
  isNew?: boolean;
  faceIdWorking?: boolean;
  screenOriginal?: boolean;
  boxIncluded?: boolean;
  chargerIncluded?: boolean;
  warrantyDays?: number;
  supplier?: string;
  costPrice: number;
  salePrice: number;
  notes?: string;
}

// costPrice qasdan yahan nahi — creation ke baad fix rehni chahiye
export type UpdateProductUnitInput = Partial<Omit<CreateProductUnitInput, 'costPrice'>>;

export async function getProductUnits(filters?: {
  productId?: string;
  status?: UnitStatus;
}): Promise<ProductUnit[]> {
  const params = new URLSearchParams();
  if (filters?.productId) params.set('productId', filters.productId);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  return apiClient.get<ProductUnit[]>(
    `/product-units${query ? `?${query}` : ''}`,
  );
}

export async function searchByImei(imei: string): Promise<ProductUnit | null> {
  try {
    return await apiClient.get<ProductUnit>(
      `/product-units/search?imei=${encodeURIComponent(imei)}`,
    );
  } catch {
    return null;
  }
}

export async function updateProductUnit(
  id: string,
  input: UpdateProductUnitInput,
): Promise<ProductUnit> {
  return apiClient.patch<ProductUnit>(`/product-units/${id}`, input);
}
