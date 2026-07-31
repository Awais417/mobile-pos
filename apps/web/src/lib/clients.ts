import { apiClient } from './api-client';
import { PaymentMethod } from './sales';

// Remaining Balance = (Total Sale Amount - Returned Amount) - Total Payments
// Received. PAID = remaining is 0, PARTIAL = something paid but balance
// remains, UNPAID = nothing paid yet. VOIDED = the sale was cancelled and
// excluded from balances. RETURNED = fully returned with nothing owed
// either way. REFUND_DUE = the shop owes this customer a refund (see
// refundDue) — always takes priority over RETURNED/PAID when shown. null =
// client has no active sales (nothing owed).
export type ClientPaymentStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'VOIDED'
  | 'RETURNED'
  | 'REFUND_DUE'
  | null;

export interface Client {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  note: string | null;
  createdAt: string;
}

export interface ClientListItem extends Client {
  // Set once this client has been deleted (soft) — hidden from the default
  // active list and the POS client picker, but never removed; their sales,
  // payments, and invoice history remain fully intact and accessible.
  archivedAt: string | null;
  salesCount: number;
  totalAmount: string;
  totalPaid: string;
  remainingBalance: string;
  // Money the shop owes this customer (Refund Later, not yet paid out) —
  // always shown separately from remainingBalance, never netted into it.
  refundDue: string;
  status: ClientPaymentStatus;
  latestSale: {
    id: string;
    date: string;
    productSummary: string;
    salesmanName: string;
  } | null;
}

export type PaymentType = 'INITIAL' | 'LATER' | 'REFUND';

export interface ClientSalePayment {
  id: string;
  invoiceNumber: number;
  saleId: string;
  // INITIAL = recorded at checkout (even if Rs 0); LATER = a "Receive
  // Payment" made afterwards; REFUND = a "Refund Now" (or a completed
  // "Refund Later") paid back to the customer — always a negative amount.
  type: PaymentType;
  amount: string;
  method: PaymentMethod;
  provider: string | null;
  bankName: string | null;
  note: string | null;
  // Running balance against this invoice's current net total, just before/
  // after this payment was applied.
  previousBalance: string;
  newBalance: string;
  receivedByName: string;
  // User-chosen "received on" date — may be backdated for a later payment.
  paidAt: string;
}

export interface ClientSaleItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  // How much of `quantity` has already been returned/voided back to stock.
  returnedQuantity: number;
}

export interface ClientSale {
  id: string;
  dailyInvoiceNumber: number;
  createdAt: string;
  totalAmount: string;
  // Sum of amounts returned against this sale (0 if nothing returned yet).
  returnedAmount: string;
  // totalAmount - returnedAmount — the actual amount still owed against.
  netAmount: string;
  paidAmount: string;
  remainingBalance: string;
  // Money the shop owes the customer on this specific invoice (excess
  // payment left after a return) — 0 unless a return created a refund.
  refundDue: string;
  status: ClientPaymentStatus;
  voidedAt: string | null;
  paymentMethod: PaymentMethod;
  salesmanName: string;
  items: ClientSaleItem[];
  payments: ClientSalePayment[];
}

export type CustomerRefundStatus = 'PENDING' | 'COMPLETED';

// A refund settlement created by the Return Settlement flow — Refund Now
// (COMPLETED immediately) or Refund Later (PENDING until settled via
// completeRefund). Separate from paymentHistory: this is money owed to the
// customer, the opposite direction of the Payment ledger.
export interface ClientRefund {
  id: string;
  saleId: string;
  dailyInvoiceNumber: number;
  amount: string;
  status: CustomerRefundStatus;
  method: PaymentMethod | null;
  referenceNumber: string | null;
  note: string | null;
  createdAt: string;
  createdByName: string;
  completedAt: string | null;
  completedByName: string | null;
}

// One "items returned" event (a client may return several items from the
// same sale in one visit) — distinct from ClientSalePayment/ClientRefund,
// which are money movements. Carries its own refund settlement, if the
// return left one, so the Returns tab needs only this one list.
export interface ClientReturnItem {
  id: string;
  productName: string;
  quantity: number;
  amount: string;
}

// Same shape as ClientRefund minus saleId/dailyInvoiceNumber — redundant
// here since ClientReturnEntry (the parent) already carries both.
export interface ClientReturnRefund {
  id: string;
  amount: string;
  status: CustomerRefundStatus;
  method: PaymentMethod | null;
  referenceNumber: string | null;
  note: string | null;
  createdAt: string;
  createdByName: string;
  completedAt: string | null;
  completedByName: string | null;
}

export interface ClientReturnEntry {
  id: string;
  saleId: string;
  dailyInvoiceNumber: number;
  reason: string | null;
  performedByName: string;
  totalAmount: string;
  createdAt: string;
  items: ClientReturnItem[];
  refund: ClientReturnRefund | null;
}

export interface ClientDetail extends Client {
  archivedAt: string | null;
  totalAmount: string;
  totalPaid: string;
  remainingBalance: string;
  refundDue: string;
  status: ClientPaymentStatus;
  sales: ClientSale[];
  // Every payment across every invoice, newest first — the same rows
  // nested under each sale above, just flattened for an at-a-glance view.
  paymentHistory: ClientSalePayment[];
  // Every refund settlement across every invoice, newest first.
  refunds: ClientRefund[];
  // Every return event across every invoice, newest first.
  returns: ClientReturnEntry[];
}

export type ClientHistoryEntryType = 'SALE' | 'PAYMENT' | 'RETURN';

export interface CreateClientInput {
  fullName: string;
  phone: string;
  address?: string;
  note?: string;
}

export interface UpdateClientInput {
  fullName?: string;
  phone?: string;
  address?: string;
  note?: string;
}

export async function getClients(params?: {
  search?: string;
  status?: string;
  includeArchived?: boolean;
}): Promise<ClientListItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status && params.status !== 'ALL') query.set('status', params.status);
  if (params?.includeArchived) query.set('includeArchived', 'true');
  const qs = query.toString();
  return apiClient.get<ClientListItem[]>(`/clients${qs ? `?${qs}` : ''}`);
}

export async function getClient(id: string): Promise<ClientDetail> {
  return apiClient.get<ClientDetail>(`/clients/${id}`);
}

// Soft delete — Admin only. Backend blocks this (and returns a clear error
// message) unless the client's outstanding balance is exactly 0. The client
// is never removed: sales, payments, and invoice history stay intact.
export async function deleteClient(id: string): Promise<void> {
  await apiClient.del(`/clients/${id}`);
}

export interface ReceivablesSummary {
  // Current outstanding balance across every client, as of now — not
  // scoped to any date range, since money owed doesn't reset per period.
  totalOutstandingReceivable: string;
  totalCollectedAllTime: string;
  // Money the shop owes customers (Refund Later, not yet paid out) — kept
  // entirely separate from totalOutstandingReceivable above.
  totalRefundPayable: string;
}

export async function getReceivablesSummary(): Promise<ReceivablesSummary> {
  return apiClient.get<ReceivablesSummary>('/clients/receivables/summary');
}

export interface CompleteRefundInput {
  method: PaymentMethod;
  provider?: string;
  bankName?: string;
  referenceNumber?: string;
  note?: string;
}

// Settles a pending "Refund Later" — pays out the amount already recorded
// as owed to the customer. `refundId` is the CustomerRefund id (see
// ClientRefund.id), not a sale id. Callers should reload the client detail
// afterward — the response here is the raw updated record, not the
// display-formatted ClientRefund shape.
export async function completeRefund(
  refundId: string,
  input: CompleteRefundInput,
): Promise<{ id: string; status: CustomerRefundStatus }> {
  return apiClient.post(`/sales/refunds/${refundId}/complete`, input);
}

// Backend reuses an existing client by phone number instead of creating a
// duplicate — `existing: true` tells the caller that happened.
export async function createClient(
  input: CreateClientInput,
): Promise<Client & { existing: boolean }> {
  return apiClient.post<Client & { existing: boolean }>('/clients', input);
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  return apiClient.patch<Client>(`/clients/${id}`, input);
}

// Hides one Sale/Payment/Return row from this client's History tabs only —
// never touches the underlying sale/payment/return record. Admin only.
export async function hideClientHistoryEntry(
  clientId: string,
  entryType: ClientHistoryEntryType,
  entryId: string,
  reason: string,
): Promise<void> {
  await apiClient.del(`/clients/${clientId}/history/${entryType}/${entryId}`, { reason });
}

// "Clear Client History" — hides every currently-visible Sale/Payment/
// Return row for this client in one action. Admin only.
export async function clearClientHistory(clientId: string, reason: string): Promise<void> {
  await apiClient.del(`/clients/${clientId}/history`, { reason });
}
