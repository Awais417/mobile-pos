import { apiClient } from './api-client';
import { PaymentMethod } from './sales';

// Remaining Balance = (Total Sale Amount - Returned Amount) - Total Payments
// Received. PAID = remaining is 0, PARTIAL = something paid but balance
// remains, UNPAID = nothing paid yet. VOIDED = the sale was cancelled and
// excluded from balances. null = client has no active sales (nothing owed).
export type ClientPaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'VOIDED' | null;

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
  status: ClientPaymentStatus;
  latestSale: {
    id: string;
    date: string;
    productSummary: string;
    salesmanName: string;
  } | null;
}

export type PaymentType = 'INITIAL' | 'LATER';

export interface ClientSalePayment {
  id: string;
  invoiceNumber: number;
  saleId: string;
  // INITIAL = recorded at checkout (even if Rs 0); LATER = a "Receive
  // Payment" made afterwards.
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
  status: ClientPaymentStatus;
  voidedAt: string | null;
  paymentMethod: PaymentMethod;
  salesmanName: string;
  items: ClientSaleItem[];
  payments: ClientSalePayment[];
}

export interface ClientDetail extends Client {
  archivedAt: string | null;
  totalAmount: string;
  totalPaid: string;
  remainingBalance: string;
  status: ClientPaymentStatus;
  sales: ClientSale[];
  // Every payment across every invoice, newest first — the same rows
  // nested under each sale above, just flattened for an at-a-glance view.
  paymentHistory: ClientSalePayment[];
}

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
}

export async function getReceivablesSummary(): Promise<ReceivablesSummary> {
  return apiClient.get<ReceivablesSummary>('/clients/receivables/summary');
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
