import { apiClient } from './api-client';

export interface SaleItemInput {
  productId: string;
  quantity: number;
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
}

export async function createSale(items: SaleItemInput[]): Promise<Sale> {
  return apiClient.post<Sale>('/sales', { items });
}

export async function getSales(): Promise<Sale[]> {
  return apiClient.get<Sale[]>('/sales');
}