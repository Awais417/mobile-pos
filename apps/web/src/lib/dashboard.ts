import { apiClient } from './api-client';

export interface DashboardKpis {
  periodRevenue: string;
  periodProfit: string;
  periodOrders: number;
  avgOrderValue: string;
  inventoryValue: string;
  lowStockCount: number;
  revenueChangePct: string;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: string;
  profit: string;
  orders: number;
}

export interface PaymentDistributionItem {
  method: string;
  amount: string;
  count: number;
  percentage: string;
}

export interface TopProduct {
  name: string;
  unitsSold: number;
  revenue: string;
  profit: string;
}

export interface CategoryRevenueItem {
  category: string;
  revenue: string;
}

export interface HourlyHeatmapPoint {
  hour: number;
  amount: string;
}

export interface CashierLeaderboardItem {
  cashierId: string;
  name: string;
  orders: number;
  revenue: string;
  avgBill: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stockQty: number;
  reorderLevel: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  revenueTrend: RevenueTrendPoint[];
  paymentDistribution: PaymentDistributionItem[];
  topProducts: TopProduct[];
  categoryRevenue: CategoryRevenueItem[];
  hourlyHeatmap: HourlyHeatmapPoint[];
  cashierLeaderboard: CashierLeaderboardItem[];
  lowStockProducts: LowStockProduct[];
}

export async function getDashboard(days: number): Promise<DashboardData> {
  return apiClient.get<DashboardData>(`/sales/dashboard?days=${days}`);
}