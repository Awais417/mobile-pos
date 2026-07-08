import { apiClient } from './api-client';

export interface SalesSummary {
  totalSales: number;
  totalRevenue: string;
  totalProfit: string;
  totalItemsSold: number;
  todayRevenue: string;
  monthRevenue: string;
}

export async function getSalesSummary(): Promise<SalesSummary> {
  return apiClient.get<SalesSummary>('/sales/summary');
}