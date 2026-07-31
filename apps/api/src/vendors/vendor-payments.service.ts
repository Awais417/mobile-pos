import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { AuthenticatedUser } from '../common/types/auth.types';
import { ReverseVendorPaymentDto } from './dto/vendor-payment.dto';

@Injectable()
export class VendorPaymentsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Every payment across every vendor, newest first — powers the Vendor
  // Payments page. Deleted (reversed) payments are excluded by default —
  // pass includeDeleted to also list them (the page's "Show Deleted
  // Payments" filter, Admin only in the UI).
  async findAll(
    businessId: string,
    filters?: { vendorId?: string; includeDeleted?: boolean },
  ) {
    this.assertTenant(businessId);
    const payments = await this.prisma.vendorPayment.findMany({
      where: {
        businessId,
        ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters?.includeDeleted ? {} : { reversedAt: null }),
      },
      orderBy: { paidAt: 'desc' },
      include: {
        vendor: { select: { id: true, businessName: true } },
        purchase: { select: { id: true, purchaseNumber: true } },
      },
    });

    const userIds = Array.from(
      new Set([
        ...payments.map((p) => p.createdBy),
        ...payments.map((p) => p.reversedBy).filter((id): id is string => !!id),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    return payments.map((p) => ({
      id: p.id,
      vendorId: p.vendorId,
      vendorName: p.vendor.businessName,
      purchaseId: p.purchaseId,
      purchaseNumber: p.purchase?.purchaseNumber ?? null,
      amount: p.amount,
      method: p.method,
      provider: p.provider,
      bankName: p.bankName,
      referenceNumber: p.referenceNumber,
      note: p.note,
      paidAt: p.paidAt,
      isInitialPayment: p.isInitialPayment,
      deductFromDashboardCash: p.deductFromDashboardCash,
      createdByName: nameMap.get(p.createdBy) ?? 'Unknown',
      reversedAt: p.reversedAt,
      reversalReason: p.reversalReason,
      reversedByName: p.reversedBy
        ? (nameMap.get(p.reversedBy) ?? 'Unknown')
        : null,
    }));
  }

  // "Delete Payment" — a soft delete/void, never a hard delete. Stamps
  // reversedAt/reversedBy/reversalReason on the same row (this is the
  // audit trail: who deleted it, when, and why) and keeps the original
  // amount/method/date untouched for financial history. From this point on
  // the payment is excluded from every "amount paid"/"remaining" calculation
  // (see the `reversedAt: null` filters in vendors.service.ts and
  // purchases.service.ts) and from the Available Sales Cash deduction on
  // the dashboard (see sales.service.ts getDashboard) — all of which
  // recompute live from non-deleted payments, so no separate reversal/ledger
  // entry is needed to keep those figures correct. Only ADMIN/ACCOUNTANT can
  // reach this (enforced by VendorPaymentsController's @Roles guard).
  async reverse(
    businessId: string,
    user: AuthenticatedUser,
    id: string,
    dto: ReverseVendorPaymentDto,
  ) {
    this.assertTenant(businessId);

    const payment = await this.prisma.vendorPayment.findFirst({
      where: { id, businessId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    if (payment.reversedAt) {
      throw new BadRequestException('This payment has already been deleted.');
    }

    return this.prisma.vendorPayment.update({
      where: { id },
      data: {
        reversedAt: new Date(),
        reversedBy: user.userId,
        reversalReason: dto.reason,
      },
    });
  }
}
