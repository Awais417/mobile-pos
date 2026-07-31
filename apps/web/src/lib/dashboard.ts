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
  // Vendor module — Collected Sales minus only the vendor payments marked
  // "Deduct from Available Sales Cash". Never changes Total Sales/Profit.
  availableSalesCash: string;
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

// Calendar-aligned period, not a rolling "last N days" window — 'date'
// additionally requires `date` ('YYYY-MM-DD'); every other key ignores it.
export type DashboardPeriodKey = 'today' | 'week' | 'month' | 'all' | 'date';

export async function getDashboard(
  period: DashboardPeriodKey,
  date?: string,
): Promise<DashboardData> {
  const query = new URLSearchParams({ period });
  if (period === 'date' && date) query.set('date', date);
  return apiClient.get<DashboardData>(`/sales/dashboard?${query.toString()}`);
}