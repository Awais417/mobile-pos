import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';

export interface SaleItemInput {
  productId: string;
  quantity: number;
}

export interface SaleItem {
  id: string;
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

function authHeader() {
  const token = tokenStorage.getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function createSale(items: SaleItemInput[]): Promise<Sale> {
  return apiClient.post<Sale>('/sales', { items }, { headers: authHeader() });
}

export async function getSales(): Promise<Sale[]> {
  return apiClient.get<Sale[]>('/sales', { headers: authHeader() });
}