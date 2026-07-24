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
}

export interface Sale {
  id: string;
  dailyInvoiceNumber: number;
  totalAmount: string;
  createdAt: string;
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  cashReceived: string | null;
  provider: string | null;
  bankName: string | null;
  cashierName: string;
}

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  return apiClient.post<Sale>('/sales', input);
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