import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';

export interface SalesSummary {
  totalSales: number;
  totalRevenue: string;
  totalItemsSold: number;
}

function authHeader() {
  const token = tokenStorage.getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function getSalesSummary(): Promise<SalesSummary> {
  return apiClient.get<SalesSummary>('/sales/summary', {
    headers: authHeader(),
  });
}