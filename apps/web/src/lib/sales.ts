import { apiClient } from './api-client';

export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE_WALLET' | 'BANK_TRANSFER';

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  provider?: string;
  bankName?: string;
  cardLastFour?: string;
  referenceNumber?: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface Sale {
  id: string;
  totalAmount: string;
  createdAt: string;
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  cashReceived: string | null;
  provider: string | null;
  bankName: string | null;
  cardLastFour: string | null;
  referenceNumber: string | null;
}

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  return apiClient.post<Sale>('/sales', input);
}

export async function getSales(): Promise<Sale[]> {
  return apiClient.get<Sale[]>('/sales');
}