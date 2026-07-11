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

      // CASH payment ke liye — received amount total se kam nahi honi chahiye
      if (dto.paymentMethod === PaymentMethod.CASH) {
        if (dto.cashReceived === undefined) {
          throw new BadRequestException('cashReceived is required for cash payments.');
        }
        if (dto.cashReceived < Number(totalAmount)) {
          throw new BadRequestException(
            `Cash received (Rs ${dto.cashReceived}) is less than total (Rs ${totalAmount}).`,
          );
        }
      }

      const sale = await tx.sale.create({
        data: {
          businessId,
          cashierId,
          totalAmount,
          paymentMethod: dto.paymentMethod,
          cashReceived: dto.cashReceived ?? null,
          provider: dto.provider ?? null,
          bankName: dto.bankName ?? null,
          cardLastFour: dto.cardLastFour ?? null,
          referenceNumber: dto.referenceNumber ?? null,
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
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
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

    // Payment method ke hisaab se totals
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
}