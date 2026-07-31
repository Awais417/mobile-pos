import { apiClient } from './api-client';

export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE_WALLET' | 'BANK_TRANSFER';

export interface SaleItemInput {
  productId: string;
  quantity: number;
  productUnitId?: string;
  price?: number;
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  provider?: string;
  bankName?: string;
  // Cashier-edited final Grand Total (whole rupees) — omitted when the
  // Grand Total was left as calculated from the cart's item prices.
  finalTotal?: number;
  // Attaches this sale to a Client — omitted for a walk-in sale (unchanged
  // default behavior).
  clientId?: string;
  // Amount being paid right now — only meaningful alongside clientId.
  // Omit to pay the full total (same as a walk-in sale).
  amountPaid?: number;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  // Sale ke waqt ki cost snapshot — profit ke display-side calculation ke
  // liye (backend hi authoritative source hai, yahan sirf sum hoti hai)
  costPrice: string;
  // How much of `quantity` has already been restored to inventory via a
  // Return or a Void. 0 = nothing returned yet.
  returnedQuantity?: number;
}

export interface Sale {
  id: string;
  dailyInvoiceNumber: number;
  totalAmount: string;
  // Original sum of item line totals, preserved for audit/reference even
  // when totalAmount was manually overridden at checkout.
  subtotalAmount: string;
  // subtotalAmount - totalAmount — positive for a discount, negative for a
  // surcharge; zero when the Grand Total was never edited.
  discountAmount: string;
  createdAt: string;
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  cashReceived: string | null;
  provider: string | null;
  bankName: string | null;
  cashierName: string;
  // Null/undefined = walk-in sale, unchanged from before Client Management existed.
  clientId?: string | null;
  client?: { id: string; fullName: string; phone: string } | null;
  // Set once this sale has been voided (cancelled) — inventory already
  // reversed, excluded from client balances, but never deleted.
  voidedAt?: string | null;
}

export interface AddPaymentInput {
  amount: number;
  method: PaymentMethod;
  provider?: string;
  bankName?: string;
  note?: string;
  // When this payment was actually received (ISO date) — lets a later
  // payment be backdated. Omit to use "now".
  paidAt?: string;
}

export interface AddPaymentResult {
  saleId: string;
  amountPaid: number;
  remainingBalance: number;
  status: 'PAID' | 'PARTIAL';
}

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  return apiClient.post<Sale>('/sales', input);
}

// "Pay Remaining" — records one more amount received against a client sale.
export async function addSalePayment(
  saleId: string,
  input: AddPaymentInput,
): Promise<AddPaymentResult> {
  return apiClient.post<AddPaymentResult>(`/sales/${saleId}/payments`, input);
}

export async function getSales(): Promise<Sale[]> {
  return apiClient.get<Sale[]>('/sales');
}

// "Archive" hides a sale from Sales History only — revenue, profit, and
// inventory are unaffected. Route name (`/sales/:id`, DELETE) is unchanged
// on the wire; only the semantics and this function's name reflect what it
// actually does.
export async function archiveSale(id: string, reason?: string): Promise<void> {
  await apiClient.del(`/sales/${id}`, reason ? { reason } : undefined);
}

export interface ReturnLineInput {
  saleItemId: string;
  quantity: number;
}

export interface ReturnItemResult {
  id: string;
  saleItemId: string;
  quantity: number;
  amount: string;
}

// The Refund Now / Refund Later choice from the Return Settlement UI —
// required only when the return leaves a refund due to the customer
// (server-computed; `amount` must equal that computed refund due exactly).
export interface RefundSettlementInput {
  mode: 'REFUND_NOW' | 'REFUND_LATER';
  amount: number;
  method?: PaymentMethod;
  provider?: string;
  bankName?: string;
  referenceNumber?: string;
  note?: string;
}

// Server-authoritative numbers after the return (and any refund settlement)
// were applied — never trust a client-side estimate for these; always
// display what the backend returns here. null when the sale has no client
// attached (a walk-in return has no due/refund concept to settle).
export interface ReturnSettlementResult {
  netSaleTotal: string;
  customerDue: string;
  refundDue: string;
  refund: { id: string; status: 'PENDING' | 'COMPLETED'; amount: string } | null;
}

export interface SaleReturnResult {
  id: string;
  saleId: string;
  reason: string | null;
  totalAmount: string;
  createdAt: string;
  items: ReturnItemResult[];
  settlement: ReturnSettlementResult | null;
}

// Returns one or more line items back to inventory — restores the exact
// IMEI unit(s) or stock quantity. Always linked to the original sale.
export async function returnSaleItems(
  saleId: string,
  input: {
    items: ReturnLineInput[];
    reason?: string;
    refundSettlement?: RefundSettlementInput;
  },
): Promise<SaleReturnResult> {
  return apiClient.post<SaleReturnResult>(`/sales/${saleId}/return`, input);
}

// Cancels a credit sale entirely — reverses inventory, excludes it from
// client balances, but the record itself is preserved (never deleted).
export async function voidSale(saleId: string, reason?: string): Promise<Sale> {
  return apiClient.post<Sale>(`/sales/${saleId}/void`, reason ? { reason } : undefined);
}