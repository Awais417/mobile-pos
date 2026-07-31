import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';

@Injectable()
export class PayablesService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async getActivePurchasesWithPayments(businessId: string) {
    return this.prisma.purchase.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        payments: true,
        vendor: { select: { id: true, businessName: true } },
      },
    });
  }

  async getSummary(businessId: string) {
    this.assertTenant(businessId);

    const purchases = await this.getActivePurchasesWithPayments(businessId);
    const now = new Date();

    let totalPayable = 0;
    let overdueAmount = 0;
    for (const p of purchases) {
      const paid = p.payments
        .filter((pay) => !pay.reversedAt)
        .reduce((s, pay) => s + Number(pay.amount), 0);
      const remaining = Math.max(Number(p.totalAmount) - paid, 0);
      totalPayable += remaining;
      if (p.dueDate && p.dueDate < now && remaining > 0) {
        overdueAmount += remaining;
      }
    }

    return {
      totalVendorPayable: totalPayable.toFixed(2),
      overdueAmount: overdueAmount.toFixed(2),
    };
  }

  // Vendor-wise outstanding balances — only vendors currently owed money.
  async getVendorWiseOutstanding(businessId: string) {
    this.assertTenant(businessId);
    const purchases = await this.getActivePurchasesWithPayments(businessId);

    const byVendor = new Map<
      string,
      { vendorName: string; outstanding: number }
    >();
    for (const p of purchases) {
      const paid = p.payments
        .filter((pay) => !pay.reversedAt)
        .reduce((s, pay) => s + Number(pay.amount), 0);
      const remaining = Math.max(Number(p.totalAmount) - paid, 0);
      if (remaining <= 0) continue;
      const entry = byVendor.get(p.vendorId) ?? {
        vendorName: p.vendor.businessName,
        outstanding: 0,
      };
      entry.outstanding += remaining;
      byVendor.set(p.vendorId, entry);
    }

    return Array.from(byVendor.entries())
      .map(([vendorId, v]) => ({
        vendorId,
        vendorName: v.vendorName,
        outstandingPayable: v.outstanding.toFixed(2),
      }))
      .sort(
        (a, b) => Number(b.outstandingPayable) - Number(a.outstandingPayable),
      );
  }

  // Outstanding purchase bills — every active purchase with a remaining
  // balance, optionally filtered to overdue-only or a due-before cutoff.
  async getOutstandingBills(
    businessId: string,
    filters?: { overdueOnly?: boolean; dueBefore?: string; vendorId?: string },
  ) {
    this.assertTenant(businessId);

    const purchases = await this.prisma.purchase.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters?.dueBefore
          ? { dueDate: { lt: new Date(filters.dueBefore) } }
          : {}),
      },
      include: {
        payments: true,
        vendor: { select: { id: true, businessName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const bills = purchases
      .map((p) => {
        const paid = p.payments
          .filter((pay) => !pay.reversedAt)
          .reduce((s, pay) => s + Number(pay.amount), 0);
        const remaining = Number(p.totalAmount) - paid;
        return {
          purchaseId: p.id,
          purchaseNumber: p.purchaseNumber,
          vendorId: p.vendor.id,
          vendorName: p.vendor.businessName,
          purchaseDate: p.purchaseDate,
          dueDate: p.dueDate,
          totalAmount: p.totalAmount,
          amountPaid: paid.toFixed(2),
          remainingAmount: remaining.toFixed(2),
          isOverdue: !!p.dueDate && p.dueDate < now && remaining > 0,
        };
      })
      .filter((b) => Number(b.remainingAmount) > 0)
      .filter((b) => (filters?.overdueOnly ? b.isOverdue : true));

    return bills;
  }
}
