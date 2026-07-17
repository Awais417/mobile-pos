import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(businessId: string, cashierId: string, dto: CreateSaleDto) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = new Prisma.Decimal(0);
      const saleItemsData: {
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[] = [];

      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId },
        });

        if (!product) {
          throw new NotFoundException(`Product not found: ${item.productId}`);
        }

        if (product.stockQty < item.quantity) {
          throw new BadRequestException(
            `Not enough stock for "${product.name}". Available: ${product.stockQty}, requested: ${item.quantity}.`,
          );
        }

        const lineTotal = product.salePrice.mul(item.quantity);
        totalAmount = totalAmount.add(lineTotal);

        saleItemsData.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.salePrice,
          lineTotal,
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      if (dto.paymentMethod === PaymentMethod.CASH) {
        if (dto.cashReceived === undefined) {
          throw new BadRequestException('cashReceived is required for cash payments.');
        }
        if (dto.cashReceived < Number(totalAmount)) {
          throw new BadRequestException(
            'The full payment must be received before completing the sale.',
          );
        }
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todaySalesCount = await tx.sale.count({
        where: { businessId, createdAt: { gte: todayStart } },
      });

      const sale = await tx.sale.create({
        data: {
          businessId,
          cashierId,
          totalAmount,
          dailyInvoiceNumber: todaySalesCount + 1,
          paymentMethod: dto.paymentMethod,
          cashReceived: dto.cashReceived ?? null,
          provider: dto.provider ?? null,
          bankName: dto.bankName ?? null,
          cardLastFour: null,
          referenceNumber: null,
          items: {
            create: saleItemsData,
          },
        },
        include: { items: true },
      });

      return sale;
    });
  }

  async findAll(businessId: string) {
    this.assertTenant(businessId);
    return this.prisma.sale.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async remove(businessId: string, saleId: string) {
    this.assertTenant(businessId);

    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    await this.prisma.sale.update({
      where: { id: saleId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getSummary(businessId: string) {
    this.assertTenant(businessId);

    const sales = await this.prisma.sale.findMany({
      where: { businessId },
      include: { items: true },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let totalRevenue = 0;
    let totalItemsSold = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;

    const productIds = new Set<string>();
    for (const sale of sales) {
      for (const item of sale.items) {
        productIds.add(item.productId);
      }
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, costPrice: true },
    });
    const costMap = new Map(products.map((p) => [p.id, Number(p.costPrice)]));

    let totalProfit = 0;

    const paymentTotals: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      ONLINE_WALLET: { amount: 0, count: 0 },
      BANK_TRANSFER: { amount: 0, count: 0 },
    };

    for (const sale of sales) {
      const saleTotal = Number(sale.totalAmount);
      totalRevenue += saleTotal;

      const saleDate = new Date(sale.createdAt);
      if (saleDate >= todayStart) todayRevenue += saleTotal;
      if (saleDate >= monthStart) monthRevenue += saleTotal;

      const methodKey = sale.paymentMethod as string;
      if (paymentTotals[methodKey]) {
        paymentTotals[methodKey].amount += saleTotal;
        paymentTotals[methodKey].count += 1;
      }

      for (const item of sale.items) {
        totalItemsSold += item.quantity;
        const cost = costMap.get(item.productId) ?? 0;
        const profit = (Number(item.unitPrice) - cost) * item.quantity;
        totalProfit += profit;
      }
    }

    return {
      totalSales: sales.length,
      totalRevenue: totalRevenue.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalItemsSold,
      todayRevenue: todayRevenue.toFixed(2),
      monthRevenue: monthRevenue.toFixed(2),
      paymentTotals: {
        cash: paymentTotals.CASH.amount.toFixed(2),
        card: paymentTotals.CARD.amount.toFixed(2),
        onlineWallet: paymentTotals.ONLINE_WALLET.amount.toFixed(2),
        bankTransfer: paymentTotals.BANK_TRANSFER.amount.toFixed(2),
        cashCount: paymentTotals.CASH.count,
        cardCount: paymentTotals.CARD.count,
        onlineWalletCount: paymentTotals.ONLINE_WALLET.count,
        bankTransferCount: paymentTotals.BANK_TRANSFER.count,
      },
    };
  }

  async getDashboard(businessId: string, days: number) {
    this.assertTenant(businessId);

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    rangeStart.setHours(0, 0, 0, 0);

    const prevRangeEnd = new Date(rangeStart);
    const prevRangeStart = new Date(rangeStart);
    prevRangeStart.setDate(prevRangeStart.getDate() - days);

    const rangeSales = await this.prisma.sale.findMany({
      where: { businessId, createdAt: { gte: rangeStart } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const prevRangeSales = await this.prisma.sale.findMany({
      where: {
        businessId,
        createdAt: { gte: prevRangeStart, lt: prevRangeEnd },
      },
    });

    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
    });
    const costMap = new Map(products.map((p) => [p.id, Number(p.costPrice)]));
    const nameMap = new Map(products.map((p) => [p.id, p.name]));

    const cashierIds = Array.from(new Set(rangeSales.map((s) => s.cashierId)));
    const cashiers = await this.prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, fullName: true },
    });
    const cashierNameMap = new Map(cashiers.map((c) => [c.id, c.fullName]));

    let periodRevenue = 0;
    let periodProfit = 0;
    const periodSales = rangeSales.length;

    let prevPeriodRevenue = 0;
    for (const s of prevRangeSales) prevPeriodRevenue += Number(s.totalAmount);

    type TrendEntry = { revenue: number; profit: number; sales: number };
    const trendMap: Map<string, TrendEntry> = new Map();

    const paymentMap: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      ONLINE_WALLET: { amount: 0, count: 0 },
      BANK_TRANSFER: { amount: 0, count: 0 },
    };

    type ProductStat = {
      name: string;
      unitsSold: number;
      revenue: number;
      profit: number;
    };
    const productStats: Map<string, ProductStat> = new Map();

    const categoryRevenue: Map<string, number> = new Map();
    const categoryOf = new Map(products.map((p) => [p.id, p.categoryId]));

    const hourlyMap = new Array(24).fill(0);

    type CashierStat = { sales: number; revenue: number };
    const cashierStats: Map<string, CashierStat> = new Map();

    for (const sale of rangeSales) {
      const saleTotal = Number(sale.totalAmount);
      const saleDate = new Date(sale.createdAt);
      const dateKey = saleDate.toISOString().slice(0, 10);
      const hour = saleDate.getHours();

      hourlyMap[hour] += saleTotal;
      periodRevenue += saleTotal;

      const trendEntry: TrendEntry = trendMap.get(dateKey) ?? {
        revenue: 0,
        profit: 0,
        sales: 0,
      };
      trendEntry.revenue += saleTotal;
      trendEntry.sales += 1;

      const method = sale.paymentMethod as string;
      if (paymentMap[method]) {
        paymentMap[method].amount += saleTotal;
        paymentMap[method].count += 1;
      }

      const cashierEntry: CashierStat = cashierStats.get(sale.cashierId) ?? {
        sales: 0,
        revenue: 0,
      };
      cashierEntry.sales += 1;
      cashierEntry.revenue += saleTotal;
      cashierStats.set(sale.cashierId, cashierEntry);

      for (const item of sale.items) {
        const cost = costMap.get(item.productId) ?? 0;
        const itemProfit = (Number(item.unitPrice) - cost) * item.quantity;
        trendEntry.profit += itemProfit;
        periodProfit += itemProfit;

        const pStat: ProductStat = productStats.get(item.productId) ?? {
          name: nameMap.get(item.productId) ?? item.productName,
          unitsSold: 0,
          revenue: 0,
          profit: 0,
        };
        pStat.unitsSold += item.quantity;
        pStat.revenue += Number(item.lineTotal);
        pStat.profit += itemProfit;
        productStats.set(item.productId, pStat);

        const catId = categoryOf.get(item.productId) ?? 'uncategorized';
        categoryRevenue.set(
          catId,
          (categoryRevenue.get(catId) ?? 0) + Number(item.lineTotal),
        );
      }

      trendMap.set(dateKey, trendEntry);
    }

    const categories = await this.prisma.category.findMany({
      where: { businessId },
    });
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

    const totalPaymentAmount = Object.values(paymentMap).reduce(
      (s, v) => s + v.amount,
      0,
    );

    const avgSaleValue = periodSales > 0 ? periodRevenue / periodSales : 0;
    const revenueChangePct =
      prevPeriodRevenue > 0
        ? ((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100
        : periodRevenue > 0
          ? 100
          : 0;

    const inventoryValue = products.reduce(
      (sum, p) => sum + Number(p.costPrice) * p.stockQty,
      0,
    );
    const lowStockProducts = products
      .filter((p) => p.stockQty <= p.reorderLevel)
      .map((p) => ({
        id: p.id,
        name: p.name,
        stockQty: p.stockQty,
        reorderLevel: p.reorderLevel,
      }));

    return {
      kpis: {
        periodRevenue: periodRevenue.toFixed(2),
        periodProfit: periodProfit.toFixed(2),
        periodSales,
        avgSaleValue: avgSaleValue.toFixed(2),
        inventoryValue: inventoryValue.toFixed(2),
        lowStockCount: lowStockProducts.length,
        revenueChangePct: revenueChangePct.toFixed(1),
      },
      revenueTrend: Array.from(trendMap.entries())
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([date, v]) => ({
          date,
          revenue: v.revenue.toFixed(2),
          profit: v.profit.toFixed(2),
          sales: v.sales,
        })),
      paymentDistribution: Object.entries(paymentMap).map(([method, v]) => ({
        method,
        amount: v.amount.toFixed(2),
        count: v.count,
        percentage:
          totalPaymentAmount > 0
            ? ((v.amount / totalPaymentAmount) * 100).toFixed(1)
            : '0.0',
      })),
      topProducts: Array.from(productStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((p) => ({
          name: p.name,
          unitsSold: p.unitsSold,
          revenue: p.revenue.toFixed(2),
          profit: p.profit.toFixed(2),
        })),
      categoryRevenue: Array.from(categoryRevenue.entries())
        .map(([catId, revenue]) => ({
          category: categoryNameMap.get(catId) ?? 'Uncategorized',
          revenue: revenue.toFixed(2),
        }))
        .sort((a, b) => Number(b.revenue) - Number(a.revenue)),
      hourlyHeatmap: hourlyMap.map((amount, hour) => ({
        hour,
        amount: amount.toFixed(2),
      })),
      cashierLeaderboard: Array.from(cashierStats.entries())
        .map(([cashierId, v]) => ({
          cashierId,
          name: cashierNameMap.get(cashierId) ?? 'Unknown',
          sales: v.sales,
          revenue: v.revenue.toFixed(2),
          avgBill: (v.revenue / v.sales).toFixed(2),
        }))
        .sort((a, b) => Number(b.revenue) - Number(a.revenue)),
      lowStockProducts,
    };
  }
}