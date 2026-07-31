import { apiClient } from './api-client';

export interface VendorListItem {
  id: string;
  businessName: string;
  phone: string;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  totalPurchaseAmount: string;
  purchaseBillsCount: number;
  distinctItems: number;
  totalUnits: number;
  totalPaid: string;
  remainingPayable: string;
}

export type PurchasePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | null;
export type PurchaseStatus = 'ACTIVE' | 'CANCELLED';

export interface VendorPurchaseRow {
  id: string;
  purchaseNumber: number;
  status: PurchaseStatus;
  purchaseDate: string;
  dueDate: string | null;
  distinctItems: number;
  totalUnits: number;
  totalAmount: string;
  amountPaid: string;
  remainingAmount: string;
  paymentStatus: PurchasePaymentStatus;
  createdByName: string;
  createdAt: string;
}

export interface VendorPaymentRow {
  id: string;
  purchaseId: string | null;
  purchaseNumber: number | null;
  amount: string;
  method: string;
  provider: string | null;
  bankName: string | null;
  referenceNumber: string | null;
  note: string | null;
  paidAt: string;
  isInitialPayment: boolean;
  deductFromDashboardCash: boolean;
  createdByName: string;
  reversedAt: string | null;
  reversalReason: string | null;
  reversedByName: string | null;
}

export interface VendorDetail {
  id: string;
  businessName: string;
  phone: string;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  summary: {
    totalPurchaseAmount: string;
    purchaseBillsCount: number;
    distinctItems: number;
    totalUnits: number;
    initialPayments: string;
    laterPayments: string;
    totalPaid: string;
    remainingPayable: string;
  };
  purchases: VendorPurchaseRow[];
  payments: VendorPaymentRow[];
}

export interface CreateVendorInput {
  businessName: string;
  phone: string;
  address?: string;
  notes?: string;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export async function getVendors(params?: {
  search?: string;
  includeArchived?: boolean;
}): Promise<VendorListItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.includeArchived) query.set('includeArchived', 'true');
  const qs = query.toString();
  return apiClient.get<VendorListItem[]>(`/vendors${qs ? `?${qs}` : ''}`);
}

export async function getVendor(id: string): Promise<VendorDetail> {
  return apiClient.get<VendorDetail>(`/vendors/${id}`);
}

export async function createVendor(input: CreateVendorInput): Promise<VendorListItem> {
  return apiClient.post<VendorListItem>('/vendors', input);
}

export async function updateVendor(
  id: string,
  input: UpdateVendorInput,
): Promise<VendorListItem> {
  return apiClient.patch<VendorListItem>(`/vendors/${id}`, input);
}

// Deactivate/reactivate — never a hard delete. A vendor with purchase or
// payment history stays fully intact either way.
export async function setVendorStatus(id: string, isActive: boolean): Promise<VendorListItem> {
  return apiClient.patch<VendorListItem>(`/vendors/${id}/status`, { isActive });
}

// Permanently deletes this vendor and every purchase/payment that belongs
// to it — distinct from setVendorStatus above, which only deactivates.
export async function deleteVendor(id: string): Promise<void> {
  await apiClient.del(`/vendors/${id}`);
}

export interface Outlet {
  id: string;
  name: string;
}

// Branch selector data for New Purchase — this app has no outlet management
// UI yet, so the list may simply be empty for a single-location business.
export async function getVendorOutlets(): Promise<Outlet[]> {
  return apiClient.get<Outlet[]>('/vendors/outlets');
}
