import { apiClient } from './api-client';
import { PaymentMethod } from './sales';
import { PurchaseStatus, PurchasePaymentStatus } from './vendors';

// Manual, free-text purchase line — never a reference into the existing
// Products/Inventory catalogue. Line Total is always computed server-side.
export interface PurchaseItemInput {
  itemName: string;
  description?: string;
  quantity: number;
  unitCost: number;
}

export interface InitialPaymentInput {
  amount: number;
  method: PaymentMethod;
  provider?: string;
  bankName?: string;
  referenceNumber?: string;
  note?: string;
  paidAt?: string;
  deductFromDashboardCash?: boolean;
}

export interface CreatePurchaseInput {
  vendorId: string;
  outletId?: string;
  purchaseDate?: string;
  dueDate?: string;
  items: PurchaseItemInput[];
  notes?: string;
  initialPayment?: InitialPaymentInput;
}

export interface PurchaseListItem {
  id: string;
  purchaseNumber: number;
  vendorId: string;
  vendorName: string;
  outletId: string | null;
  status: PurchaseStatus;
  purchaseDate: string;
  dueDate: string | null;
  distinctItems: number;
  totalUnits: number;
  totalAmount: string;
  amountPaid: string;
  remainingAmount: string;
  paymentStatus: PurchasePaymentStatus;
  createdAt: string;
}

export interface PurchaseItemRow {
  id: string;
  itemName: string;
  description: string | null;
  quantity: number;
  unitCost: string;
  lineTotal: string;
}

export interface PurchasePaymentRow {
  id: string;
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

export interface PurchaseDetail {
  id: string;
  purchaseNumber: number;
  vendorId: string;
  vendorName: string;
  outletId: string | null;
  status: PurchaseStatus;
  purchaseDate: string;
  dueDate: string | null;
  totalAmount: string;
  amountPaid: string;
  remainingAmount: string;
  paymentStatus: PurchasePaymentStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: PurchaseItemRow[];
  payments: PurchasePaymentRow[];
}

export async function getPurchases(filters?: {
  vendorId?: string;
  status?: string;
  outletId?: string;
}): Promise<PurchaseListItem[]> {
  const query = new URLSearchParams();
  if (filters?.vendorId) query.set('vendorId', filters.vendorId);
  if (filters?.status) query.set('status', filters.status);
  if (filters?.outletId) query.set('outletId', filters.outletId);
  const qs = query.toString();
  return apiClient.get<PurchaseListItem[]>(`/purchases${qs ? `?${qs}` : ''}`);
}

export async function getPurchase(id: string): Promise<PurchaseDetail> {
  return apiClient.get<PurchaseDetail>(`/purchases/${id}`);
}

// Records a manual purchase (no product/inventory link) and, optionally,
// its initial/advance payment — never creates stock of any kind.
export async function createPurchase(input: CreatePurchaseInput): Promise<PurchaseDetail> {
  return apiClient.post<PurchaseDetail>('/purchases', input);
}

export async function cancelPurchase(id: string, reason?: string): Promise<PurchaseDetail> {
  return apiClient.post<PurchaseDetail>(`/purchases/${id}/cancel`, reason ? { reason } : {});
}

// Hard-deletes this purchase bill entirely — blocked (400) if any vendor
// payment is linked to it. Distinct from cancelPurchase above, which only
// marks it CANCELLED and keeps the row.
export async function deletePurchase(id: string): Promise<void> {
  await apiClient.del(`/purchases/${id}`);
}

export interface AddPurchasePaymentInput {
  amount: number;
  method: PaymentMethod;
  provider?: string;
  bankName?: string;
  referenceNumber?: string;
  note?: string;
  paidAt?: string;
  deductFromDashboardCash?: boolean;
}

export interface AddPurchasePaymentResult {
  purchaseId: string;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL';
}

// "Record Vendor Payment" / "Add Payment" against this one specific bill —
// used for every later payment after the original purchase.
export async function addPurchasePayment(
  id: string,
  input: AddPurchasePaymentInput,
): Promise<AddPurchasePaymentResult> {
  return apiClient.post<AddPurchasePaymentResult>(`/purchases/${id}/payments`, input);
}
