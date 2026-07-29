import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PaymentMethod, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { VoidSaleDto } from './dto/void-sale.dto';

@Injectable()
export class SalesService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    businessId: string,
    cashierId: string,
    dto: CreateSaleDto,
    role?: string,
  ) {
    this.assertTenant(businessId);

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, businessId },
      });
      if (!client) {
        throw new NotFoundException('Selected client not found.');
      }
    }

    const createdSale = await this.prisma.$transaction(async (tx) => {
      let subtotalAmount = new Prisma.Decimal(0);
      const saleItemsData: {
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        costPrice: Prisma.Decimal;
        productUnitId: string | null;
      }[] = [];

      const unitsToMarkSold: string[] = [];

      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId },
        });

        if (!product) {
          throw new NotFoundException(`Product not found: ${item.productId}`);
        }

        if (product.isSerialized) {
          if (!item.productUnitId) {
            throw new BadRequestException(
              `"${product.name}" is a serialized product. Please select a specific unit (IMEI).`,
            );
          }

          const unit = await tx.productUnit.findFirst({
            where: {
              id: item.productUnitId,
              businessId,
              productId: product.id,
            },
          });

          if (!unit) {
            throw new NotFoundException('Selected phone/unit not found.');
          }

          if (unit.status !== UnitStatus.IN_STOCK) {
            throw new BadRequestException(
              `This unit (IMEI: ${unit.imei1}) is not available (status: ${unit.status}).`,
            );
          }

          if (item.price === undefined && unit.salePrice === null) {
            throw new BadRequestException(
              `A selling price is required for "${product.name}" (IMEI: ${unit.imei1}) — enter a price before completing this sale.`,
            );
          }
          const finalPrice = item.price ?? Number(unit.salePrice);
          const lineTotal = new Prisma.Decimal(finalPrice);
          subtotalAmount = subtotalAmount.add(lineTotal);

          saleItemsData.push({
            productId: product.id,
            productName: `${product.name} (IMEI: ${unit.imei1})`,
            quantity: 1,
            unitPrice: lineTotal,
            lineTotal,
            // Us specific physical unit ki asal cost — Product.costPrice nahi,
            // taake har IMEI ki alag cost sahi tarah snapshot ho
            costPrice: unit.costPrice,
            productUnitId: unit.id,
          });

          unitsToMarkSold.push(unit.id);
        } else {
          if (product.stockQty < item.quantity) {
            throw new BadRequestException(
              `Not enough stock for "${product.name}". Available: ${product.stockQty}, requested: ${item.quantity}.`,
            );
          }

          if (!item.price && product.salePrice === null) {
            throw new BadRequestException(
              `A selling price is required for "${product.name}" — enter a price before completing this sale.`,
            );
          }
          const unitPrice = item.price
            ? new Prisma.Decimal(item.price)
            : new Prisma.Decimal(product.salePrice ?? 0);
          const lineTotal = unitPrice.mul(item.quantity);
          subtotalAmount = subtotalAmount.add(lineTotal);

          saleItemsData.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
            // Sale ke waqt ki cost snapshot — product baad mein archive/delete
            // ya cost edit ho jaye to bhi is sale ka profit kabhi na badle
            costPrice: product.costPrice,
            productUnitId: null,
          });

          await tx.product.update({
            where: { id: product.id },
            data: { stockQty: { decrement: item.quantity } },
          });
        }
      }

      // The cashier may have overridden the Grand Total at checkout (a
      // manual adjustment/discount, never a change to any item's own price).
      // subtotalAmount — the true sum of item line totals — is always kept
      // as-is for audit; totalAmount becomes the edited figure and
      // discountAmount records the gap between the two.
      const totalAmount =
        dto.finalTotal !== undefined
          ? new Prisma.Decimal(dto.finalTotal)
          : subtotalAmount;
      const discountAmount = subtotalAmount.sub(totalAmount);

      // Walk-in sales (no clientId) keep the pre-existing rule: full payment
      // is required upfront. A client sale may instead be paid partially —
      // amountPaid defaults to the full total when not given, so behavior is
      // identical unless the caller explicitly asks for a partial payment.
      const amountPaid = dto.clientId
        ? (dto.amountPaid ?? Number(totalAmount))
        : Number(totalAmount);

      if (amountPaid > Number(totalAmount)) {
        throw new BadRequestException(
          'Amount paid cannot exceed the sale total.',
        );
      }

      if (dto.paymentMethod === PaymentMethod.CASH) {
        if (dto.cashReceived === undefined) {
          throw new BadRequestException(
            'cashReceived is required for cash payments.',
          );
        }
        if (!dto.clientId && dto.cashReceived < Number(totalAmount)) {
          throw new BadRequestException(
            'The full payment must be received before completing the sale.',
          );
        }
        if (dto.clientId && dto.cashReceived < amountPaid) {
          throw new BadRequestException(
            'Cash received must cover the amount being paid now.',
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
          clientId: dto.clientId ?? null,
          totalAmount,
          subtotalAmount,
          discountAmount,
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
        include: { items: true, client: true },
      });

      for (const unitId of unitsToMarkSold) {
        await tx.productUnit.update({
          where: { id: unitId },
          data: { status: UnitStatus.SOLD },
        });
      }

      // Only client-attached sales track a Payment ledger — walk-in sales
      // stay exactly as they were (fully paid at creation, no Payment rows).
      // The initial payment is always recorded as its own transaction, even
      // when it's Rs 0 (a fully unpaid credit sale), so payment history has
      // a first "Initial Payment" entry to build on.
      if (dto.clientId) {
        await tx.payment.create({
          data: {
            businessId,
            saleId: sale.id,
            clientId: dto.clientId,
            amount: new Prisma.Decimal(amountPaid),
            method: dto.paymentMethod,
            provider: dto.provider ?? null,
            bankName: dto.bankName ?? null,
            receivedBy: cashierId,
            isInitialPayment: true,
          },
        });
      }

      return sale;
    });

    // Salesman ko apne hi checkout ki receipt mein bhi costPrice/profit nazar
    // nahi aana chahiye — sirf ADMIN dekh sakta hai.
    if (role !== 'ADMIN') {
      return {
        ...createdSale,
        items: createdSale.items.map((item) => ({ ...item, costPrice: null })),
      };
    }
    return createdSale;
  }

  async findAll(businessId: string) {
    this.assertTenant(businessId);
    const sales = await this.prisma.sale.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    // cashierId se naam resolve karte hain (same pattern jo getDashboard()
    // mein already istemal hoti hai) — Sale/cashierId par koi Prisma relation
    // nahi hai, isliye ek alag lookup query
    const cashierIds = Array.from(new Set(sales.map((s) => s.cashierId)));
    const cashiers = await this.prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, fullName: true },
    });
    const cashierNameMap = new Map(cashiers.map((c) => [c.id, c.fullName]));

    return sales.map((s) => ({
      ...s,
      cashierName: cashierNameMap.get(s.cashierId) ?? 'Unknown',
    }));
  }

  // "Archive" — hides a sale from Sales History only. Revenue, profit, the
  // sale/items themselves, and inventory/unit status are never touched here.
  // This is deliberately NOT a Return: nothing is reversed, nothing is
  // restored to stock. Every archive is written to SaleAuditLog, which
  // application code only ever inserts into, never updates or deletes.
  async archive(
    businessId: string,
    saleId: string,
    performedBy: string,
    reason?: string,
  ) {
    this.assertTenant(businessId);

    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId, deletedAt: null },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    await this.prisma.$transaction([
      this.prisma.sale.update({
        where: { id: saleId },
        data: {
          deletedAt: new Date(),
          archivedBy: performedBy,
          archiveReason: reason ?? null,
        },
      }),
      this.prisma.saleAuditLog.create({
        data: {
          businessId,
          saleId,
          action: 'ARCHIVE',
          reason: reason ?? null,
          performedBy,
        },
      }),
    ]);

    return { success: true };
  }

  // "Pay Remaining" — records one more amount received against a client
  // sale. Never edits totalAmount/subtotalAmount/discountAmount; the
  // remaining balance is always (re)derived by summing every Payment row.
  async addPayment(
    businessId: string,
    saleId: string,
    receivedBy: string,
    dto: CreatePaymentDto,
  ) {
    this.assertTenant(businessId);

    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId, deletedAt: null },
      include: { payments: true, returns: true },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    if (!sale.clientId) {
      throw new BadRequestException(
        'This sale has no client attached — payments can only be recorded against a client sale.',
      );
    }

    if (sale.voidedAt) {
      throw new BadRequestException(
        'This sale has been voided — payments can no longer be recorded against it.',
      );
    }

    const alreadyPaid = sale.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    // Net of any returns — the true amount this invoice can still collect.
    const returnedAmount = sale.returns.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const netAmount = Number(sale.totalAmount) - returnedAmount;
    const remaining = netAmount - alreadyPaid;

    if (remaining <= 0) {
      throw new BadRequestException('This sale is already fully paid.');
    }

    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Payment cannot exceed the remaining balance of ${remaining.toFixed(2)}.`,
      );
    }

    // A payment can't predate the invoice it's paying off — also keeps the
    // initial-payment-is-always-first invariant intact for payment history's
    // running previous/new balance calculation.
    if (dto.paidAt && new Date(dto.paidAt) < sale.createdAt) {
      throw new BadRequestException(
        'Payment date cannot be before this invoice was created.',
      );
    }

    // Guards against an accidental duplicate submit (double-click, a
    // retried request) — an identical amount+method recorded for this same
    // sale moments ago is almost certainly the same payment, not a second
    // genuine one.
    const tenSecondsAgo = new Date(Date.now() - 10_000);
    const possibleDuplicate = await this.prisma.payment.findFirst({
      where: {
        saleId,
        amount: new Prisma.Decimal(dto.amount),
        method: dto.method,
        createdAt: { gte: tenSecondsAgo },
      },
    });
    if (possibleDuplicate) {
      throw new BadRequestException(
        'This payment looks like a duplicate of one just recorded. Refresh and check payment history before trying again.',
      );
    }

    await this.prisma.payment.create({
      data: {
        businessId,
        saleId,
        clientId: sale.clientId,
        amount: new Prisma.Decimal(dto.amount),
        method: dto.method,
        provider: dto.provider ?? null,
        bankName: dto.bankName ?? null,
        note: dto.note ?? null,
        receivedBy,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      },
    });

    const newRemaining = remaining - dto.amount;

    return {
      saleId,
      amountPaid: alreadyPaid + dto.amount,
      remainingBalance: newRemaining,
      status: newRemaining <= 0 ? 'PAID' : 'PARTIAL',
    };
  }

  // Returns one or more line items from a sale back to inventory — always
  // linked to the original Sale (never a standalone "take back" record).
  // Works for any sale (walk-in or client); a client's balance is simply
  // whatever's left of the (now smaller) net sale total once one exists.
  async returnItems(
    businessId: string,
    saleId: string,
    performedBy: string,
    dto: CreateReturnDto,
  ) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, businessId },
        include: { items: true },
      });
      if (!sale) {
        throw new NotFoundException('Sale not found.');
      }
      if (sale.voidedAt) {
        throw new BadRequestException(
          'This sale has been voided and cannot be returned against.',
        );
      }

      let totalAmount = new Prisma.Decimal(0);
      const returnItemsData: {
        saleItemId: string;
        quantity: number;
        amount: Prisma.Decimal;
      }[] = [];

      for (const line of dto.items) {
        const item = sale.items.find((i) => i.id === line.saleItemId);
        if (!item) {
          throw new NotFoundException(
            `Sale item not found: ${line.saleItemId}`,
          );
        }

        // Never restore more than was actually sold and not yet returned —
        // this is what makes a repeated/duplicate return request safe.
        const returnable = item.quantity - item.returnedQuantity;
        if (line.quantity > returnable) {
          throw new BadRequestException(
            `Cannot return ${line.quantity} of "${item.productName}" — only ${returnable} available to return.`,
          );
        }

        const amount = item.unitPrice.mul(line.quantity);
        totalAmount = totalAmount.add(amount);
        returnItemsData.push({
          saleItemId: item.id,
          quantity: line.quantity,
          amount,
        });

        if (item.productUnitId) {
          // Serialized — quantity is always 1, restore the exact IMEI unit.
          await tx.productUnit.update({
            where: { id: item.productUnitId },
            data: { status: UnitStatus.IN_STOCK },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: line.quantity } },
          });
        }

        await tx.saleItem.update({
          where: { id: item.id },
          data: { returnedQuantity: { increment: line.quantity } },
        });
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          businessId,
          saleId,
          reason: dto.reason ?? null,
          performedBy,
          totalAmount,
          items: { create: returnItemsData },
        },
        include: { items: true },
      });

      await tx.saleAuditLog.create({
        data: {
          businessId,
          saleId,
          action: 'RETURN',
          reason: dto.reason ?? null,
          performedBy,
        },
      });

      return saleReturn;
    });
  }

  // Cancels a credit sale entirely — unlike Archive (a visibility-only hide,
  // see archive() above), Void actually reverses inventory and is excluded
  // from client balances. The Sale row itself is never deleted; voidedAt
  // marks it and it stays visible (as VOIDED) in every history view.
  async voidSale(
    businessId: string,
    saleId: string,
    performedBy: string,
    dto: VoidSaleDto,
  ) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, businessId },
        include: { items: true },
      });
      if (!sale) {
        throw new NotFoundException('Sale not found.');
      }
      if (sale.voidedAt) {
        throw new BadRequestException('This sale has already been voided.');
      }

      for (const item of sale.items) {
        // Only restore whatever hasn't already been returned — a partially
        // returned sale that's then voided only gives back the remainder,
        // so nothing is ever restored to stock twice.
        const remaining = item.quantity - item.returnedQuantity;
        if (remaining > 0) {
          if (item.productUnitId) {
            await tx.productUnit.update({
              where: { id: item.productUnitId },
              data: { status: UnitStatus.IN_STOCK },
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { increment: remaining } },
            });
          }
          await tx.saleItem.update({
            where: { id: item.id },
            data: { returnedQuantity: item.quantity },
          });
        }
      }

      const voided = await tx.sale.update({
        where: { id: saleId },
        data: {
          voidedAt: new Date(),
          voidedBy: performedBy,
          voidReason: dto.reason ?? null,
        },
      });

      await tx.saleAuditLog.create({
        data: {
          businessId,
          saleId,
          action: 'VOID',
          reason: dto.reason ?? null,
          performedBy,
        },
      });

      return voided;
    });
  }

  async getSummary(businessId: string) {
    this.assertTenant(businessId);

    // Archived sales are only hidden from the visible Sales History list —
    // Revenue/Profit are permanent financial records and must never shrink
    // just because a sale was archived, so this query deliberately does NOT
    // filter by deletedAt.
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
    let totalCost = 0;
    let totalItemsSold = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;

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
        // costPrice sale ke waqt snapshot ki gayi hai — kabhi live Product se
        // dobara nahi nikaalte, taake product archive/delete/edit ho jaye to
        // bhi purana profit kabhi na badle
        const cost = Number(item.costPrice) * item.quantity;
        totalCost += cost;
        totalProfit += Number(item.lineTotal) - cost;
      }
    }

    return {
      totalSales: sales.length,
      totalRevenue: totalRevenue.toFixed(2),
      totalCost: totalCost.toFixed(2),
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

    // Archived sales stay in these figures — see getSummary() above for why.
    // Voided sales are excluded here (unlike Archive, a Void is not a
    // financially valid sale — its inventory has already been reversed).
    const rangeSales = await this.prisma.sale.findMany({
      where: { businessId, createdAt: { gte: rangeStart }, voidedAt: null },
      include: { items: true, returns: true },
      orderBy: { createdAt: 'asc' },
    });

    const prevRangeSales = await this.prisma.sale.findMany({
      where: {
        businessId,
        createdAt: { gte: prevRangeStart, lt: prevRangeEnd },
        voidedAt: null,
      },
    });

    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
    });
    const nameMap = new Map(products.map((p) => [p.id, p.name]));

    // Phones ka asal stock ProductUnit rows mein hai, Product.stockQty mein nahi
    const productUnits = await this.prisma.productUnit.findMany({
      where: { businessId },
    });

    const cashierIds = Array.from(new Set(rangeSales.map((s) => s.cashierId)));
    const cashiers = await this.prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, fullName: true },
    });
    const cashierNameMap = new Map(cashiers.map((c) => [c.id, c.fullName]));

    let periodRevenue = 0;
    let periodCost = 0;
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
      // A partial return only gives back the returned item(s) — Revenue
      // must drop by exactly that returned amount, never the whole sale.
      const saleReturnedRevenue = sale.returns.reduce(
        (sum, r) => sum + Number(r.totalAmount),
        0,
      );
      const saleTotal = Number(sale.totalAmount) - saleReturnedRevenue;
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
        // Only the not-yet-returned portion of this line still counts —
        // costPrice/unitPrice themselves are the sale-time snapshot (live
        // Product state never affects a past sale's profit).
        const effectiveQty = item.quantity - item.returnedQuantity;
        const itemRevenue = Number(item.unitPrice) * effectiveQty;
        const itemCost = Number(item.costPrice) * effectiveQty;
        const itemProfit = itemRevenue - itemCost;
        trendEntry.profit += itemProfit;
        periodCost += itemCost;
        periodProfit += itemProfit;

        const pStat: ProductStat = productStats.get(item.productId) ?? {
          name: nameMap.get(item.productId) ?? item.productName,
          unitsSold: 0,
          revenue: 0,
          profit: 0,
        };
        pStat.unitsSold += effectiveQty;
        pStat.revenue += itemRevenue;
        pStat.profit += itemProfit;
        productStats.set(item.productId, pStat);

        const catId = categoryOf.get(item.productId) ?? 'uncategorized';
        categoryRevenue.set(
          catId,
          (categoryRevenue.get(catId) ?? 0) + itemRevenue,
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

    // Total Products = product definitions (models). Total Inventory = every
    // physical device ever recorded (any status) + current accessory stockQty —
    // these are two different numbers and must not be confused. Available/Sold
    // are the IN_STOCK/SOLD breakdown of that same Total Inventory figure.
    const availableDevices = productUnits.filter(
      (u) => u.status === 'IN_STOCK',
    ).length;
    const soldDevices = productUnits.filter((u) => u.status === 'SOLD').length;
    const totalProducts = products.length;
    const accessoryQty = products
      .filter((p) => !p.isSerialized)
      .reduce((sum, p) => sum + p.stockQty, 0);
    const totalInventory = productUnits.length + accessoryQty;

    // Inventory Value cost price se — kabhi selling price se nahi
    const inventoryValue =
      productUnits
        .filter((u) => u.status === 'IN_STOCK')
        .reduce((sum, u) => sum + Number(u.costPrice), 0) +
      products
        .filter((p) => !p.isSerialized)
        .reduce((sum, p) => sum + Number(p.costPrice) * p.stockQty, 0);

    // Serialized (phone) products stock IMEI units se count hota hai,
    // isliye ye kabhi "Low Stock" mein nahi ginte.
    const lowStockProducts = products
      .filter((p) => !p.isSerialized && p.stockQty <= p.reorderLevel)
      .map((p) => ({
        id: p.id,
        name: p.name,
        stockQty: p.stockQty,
        reorderLevel: p.reorderLevel,
      }));

    // --- Cash Collection — kept entirely separate from Sales Performance
    // above. An installment sale's full price counts toward periodRevenue
    // the moment it's made; only the portion actually received counts here.
    // Amount Collected = every Payment (initial or later) received during
    // this period, regardless of which invoice it's against, plus walk-in
    // sales made in this period (they carry no Payment rows — they're fully
    // collected at creation instead, net of any return/void).
    const periodPayments = await this.prisma.payment.findMany({
      where: { businessId, paidAt: { gte: rangeStart } },
    });
    const collectedFromPayments = periodPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const collectedFromWalkIns = rangeSales
      .filter((s) => !s.clientId)
      .reduce((sum, s) => {
        if (s.voidedAt) return sum;
        const returned = s.returns.reduce(
          (rSum, r) => rSum + Number(r.totalAmount),
          0,
        );
        return sum + (Number(s.totalAmount) - returned);
      }, 0);
    const periodCollected = collectedFromPayments + collectedFromWalkIns;

    const periodExpenseAgg = await this.prisma.expense.aggregate({
      where: { businessId, date: { gte: rangeStart } },
      _sum: { amount: true },
    });
    const periodExpenses = Number(periodExpenseAgg._sum.amount ?? 0);
    // Net Cash — true cash-basis net (Collected - Expenses), distinct from
    // the existing accrual-basis "Net Sales" (Revenue - Expenses) shown
    // elsewhere on the Dashboard.
    const periodNetCash = periodCollected - periodExpenses;

    return {
      kpis: {
        periodRevenue: periodRevenue.toFixed(2),
        periodCost: periodCost.toFixed(2),
        periodProfit: periodProfit.toFixed(2),
        periodSales,
        avgSaleValue: avgSaleValue.toFixed(2),
        totalProducts,
        totalInventory,
        availableDevices,
        soldDevices,
        inventoryValue: inventoryValue.toFixed(2),
        lowStockCount: lowStockProducts.length,
        revenueChangePct: revenueChangePct.toFixed(1),
        periodCollected: periodCollected.toFixed(2),
        periodExpenses: periodExpenses.toFixed(2),
        periodNetCash: periodNetCash.toFixed(2),
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
