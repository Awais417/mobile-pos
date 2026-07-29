import { apiClient } from './api-client';

export interface DashboardKpis {
  periodRevenue: string;
  periodCost: string;
  periodProfit: string;
  periodSales: number;
  avgSaleValue: string;
  totalProducts: number;
  totalInventory: number;
  availableDevices: number;
  soldDevices: number;
  inventoryValue: string;
  lowStockCount: number;
  revenueChangePct: string;
  // Cash Collection — kept separate from Sales Performance above. An
  // installment sale's full price counts toward periodRevenue immediately;
  // only what's actually been received counts here.
  periodCollected: string;
  periodExpenses: string;
  periodNetCash: string;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: string;
  profit: string;
  sales: number;
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
  sales: number;
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