import { apiClient } from './api-client';

export interface PayablesSummary {
  totalVendorPayable: string;
  overdueAmount: string;
}

export interface VendorOutstandingRow {
  vendorId: string;
  vendorName: string;
  outstandingPayable: string;
}

export interface OutstandingBillRow {
  purchaseId: string;
  purchaseNumber: number;
  vendorId: string;
  vendorName: string;
  purchaseDate: string;
  dueDate: string | null;
  totalAmount: string;
  amountPaid: string;
  remainingAmount: string;
  isOverdue: boolean;
}

export async function getPayablesSummary(): Promise<PayablesSummary> {
  return apiClient.get<PayablesSummary>('/payables/summary');
}

export async function getVendorWiseOutstanding(): Promise<VendorOutstandingRow[]> {
  return apiClient.get<VendorOutstandingRow[]>('/payables/vendors');
}

export async function getOutstandingBills(filters?: {
  overdueOnly?: boolean;
  dueBefore?: string;
  vendorId?: string;
}): Promise<OutstandingBillRow[]> {
  const query = new URLSearchParams();
  if (filters?.overdueOnly) query.set('overdueOnly', 'true');
  if (filters?.dueBefore) query.set('dueBefore', filters.dueBefore);
  if (filters?.vendorId) query.set('vendorId', filters.vendorId);
  const qs = query.toString();
  return apiClient.get<OutstandingBillRow[]>(`/payables/bills${qs ? `?${qs}` : ''}`);
}
