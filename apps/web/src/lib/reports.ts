import { apiClient } from './api-client';

export interface PaymentTotals {
  cash: string;
  card: string;
  onlineWallet: string;
  bankTransfer: string;
  cashCount: number;
  cardCount: number;
  onlineWalletCount: number;
  bankTransferCount: number;
}

export interface SalesSummary {
  totalSales: number;
  totalRevenue: string;
  totalCost: string;
  totalProfit: string;
  totalItemsSold: number;
  todayRevenue: string;
  monthRevenue: string;
  paymentTotals: PaymentTotals;
}

export async function getSalesSummary(): Promise<SalesSummary> {
  return apiClient.get<SalesSummary>('/sales/summary');
}