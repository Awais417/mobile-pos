import { apiClient } from './api-client';
import { VendorPaymentRow } from './vendors';

export interface VendorPaymentListItem extends VendorPaymentRow {
  vendorId: string;
  vendorName: string;
}

// Excludes deleted (voided) payments by default — pass includeDeleted to
// also list them (the page's "Show Deleted Payments" filter, Admin only).
export async function getVendorPayments(
  vendorId?: string,
  includeDeleted?: boolean,
): Promise<VendorPaymentListItem[]> {
  const query = new URLSearchParams();
  if (vendorId) query.set('vendorId', vendorId);
  if (includeDeleted) query.set('includeDeleted', 'true');
  const qs = query.toString();
  return apiClient.get<VendorPaymentListItem[]>(`/vendor-payments${qs ? `?${qs}` : ''}`);
}

// "Delete Payment" — never a hard delete, stamps reversedAt/reversedBy/
// reversalReason. Excluded from every "amount paid"/remaining calculation
// and from Available Sales Cash on the dashboard from that point on. A
// reason is required. Only ADMIN/ACCOUNTANT can call this.
export async function deleteVendorPayment(id: string, reason: string) {
  return apiClient.post(`/vendor-payments/${id}/reverse`, { reason });
}
