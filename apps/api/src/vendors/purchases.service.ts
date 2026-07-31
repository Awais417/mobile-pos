import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, PurchaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { AuthenticatedUser } from '../common/types/auth.types';
import { VendorsService } from './vendors.service';
import {
  CreatePurchaseDto,
  PurchaseItemInputDto,
} from './dto/create-purchase.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { CreateVendorPaymentDto } from './dto/vendor-payment.dto';

function computeTotal(items: PurchaseItemInputDto[]) {
  return items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
}

@Injectable()
export class PurchasesService extends TenantScopedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorsService: VendorsService,
  ) {
    super();
  }

  // Branch Manager may only touch purchases for their own outlet — Admin and
  // Accountant (view-only elsewhere) are never outlet-restricted here.
  private assertBranchAccess(
    user: AuthenticatedUser,
    purchase: { outletId: string | null },
  ) {
    if (user.role !== 'BRANCH_MANAGER') return;
    if (!user.outletId || purchase.outletId !== user.outletId) {
      throw new ForbiddenException(
        'You can only access purchases for your own branch.',
      );
    }
  }

  private resolveOutletId(user: AuthenticatedUser, requested?: string) {
    if (user.role !== 'BRANCH_MANAGER') return requested ?? null;
    if (!user.outletId) {
      throw new BadRequestException(
        'Your account has no branch assigned — contact an administrator.',
      );
    }
    return user.outletId;
  }

  // Creates the purchase (manual items only — never touches Product/
  // ProductUnit/stock) and, if an initial payment was given, records it in
  // the same transaction. Nothing here creates inventory of any kind.
  async create(
    businessId: string,
    user: AuthenticatedUser,
    dto: CreatePurchaseDto,
  ) {
    this.assertTenant(businessId);
    const outletId = this.resolveOutletId(user, dto.outletId);

    return this.prisma.$transaction(async (tx) => {
      await this.vendorsService.assertActiveVendor(
        tx,
        businessId,
        dto.vendorId,
      );

      if (outletId) {
        const outlet = await tx.outlet.findFirst({
          where: { id: outletId, businessId },
        });
        if (!outlet) {
          throw new NotFoundException('Selected branch not found.');
        }
      }

      const totalAmount = computeTotal(dto.items);
      if (totalAmount <= 0) {
        throw new BadRequestException(
          'Enter at least one item with a valid quantity and unit cost.',
        );
      }

      if (dto.initialPayment) {
        if (dto.initialPayment.amount < 0) {
          throw new BadRequestException('Initial payment cannot be negative.');
        }
        if (dto.initialPayment.amount > totalAmount) {
          throw new BadRequestException(
            'Initial payment cannot exceed the purchase total.',
          );
        }
      }

      const count = await tx.purchase.count({ where: { businessId } });

      const purchase = await tx.purchase.create({
        data: {
          businessId,
          vendorId: dto.vendorId,
          outletId,
          purchaseNumber: count + 1,
          purchaseDate: dto.purchaseDate
            ? new Date(dto.purchaseDate)
            : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: PurchaseStatus.ACTIVE,
          totalAmount,
          notes: dto.notes ?? null,
          createdBy: user.userId,
          items: {
            create: dto.items.map((i) => ({
              itemName: i.itemName.trim(),
              description: i.description?.trim() || null,
              quantity: i.quantity,
              unitCost: i.unitCost,
              lineTotal: new Prisma.Decimal(i.unitCost).mul(i.quantity),
            })),
          },
        },
        include: { items: true },
      });

      // Initial/advance payment — created as its own Payment row so
      // history always has a first "Initial Payment" entry to build on,
      // even one made for the full total (fully paid at creation).
      if (dto.initialPayment && dto.initialPayment.amount > 0) {
        await tx.vendorPayment.create({
          data: {
            businessId,
            vendorId: dto.vendorId,
            purchaseId: purchase.id,
            amount: dto.initialPayment.amount,
            method: dto.initialPayment.method,
            provider: dto.initialPayment.provider ?? null,
            bankName: dto.initialPayment.bankName ?? null,
            referenceNumber: dto.initialPayment.referenceNumber ?? null,
            note: dto.initialPayment.note ?? null,
            paidAt: dto.initialPayment.paidAt
              ? new Date(dto.initialPayment.paidAt)
              : new Date(),
            isInitialPayment: true,
            deductFromDashboardCash:
              dto.initialPayment.deductFromDashboardCash ?? false,
            createdBy: user.userId,
          },
        });
      }

      return purchase;
    });
  }

  async findAll(
    businessId: string,
    user: AuthenticatedUser,
    filters: { vendorId?: string; status?: string; outletId?: string },
  ) {
    this.assertTenant(businessId);

    const outletFilter =
      user.role === 'BRANCH_MANAGER'
        ? (user.outletId ?? '__none__')
        : filters.outletId;

    const purchases = await this.prisma.purchase.findMany({
      where: {
        businessId,
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.status ? { status: filters.status as PurchaseStatus } : {}),
        ...(outletFilter ? { outletId: outletFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payments: true, vendor: true },
    });

    return purchases.map((p) => {
      const amountPaid = p.payments
        .filter((pay) => !pay.reversedAt)
        .reduce((sum, pay) => sum + Number(pay.amount), 0);
      const remainingAmount = Number(p.totalAmount) - amountPaid;
      const paymentStatus =
        p.status !== 'ACTIVE'
          ? null
          : amountPaid <= 0
            ? ('UNPAID' as const)
            : remainingAmount <= 0
              ? ('PAID' as const)
              : ('PARTIAL' as const);

      return {
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        vendorId: p.vendorId,
        vendorName: p.vendor.businessName,
        outletId: p.outletId,
        status: p.status,
        purchaseDate: p.purchaseDate,
        dueDate: p.dueDate,
        distinctItems: new Set(p.items.map((i) => i.itemName)).size,
        totalUnits: p.items.reduce((s, i) => s + i.quantity, 0),
        totalAmount: p.totalAmount,
        amountPaid: amountPaid.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        paymentStatus,
        createdAt: p.createdAt,
      };
    });
  }

  async findOne(businessId: string, user: AuthenticatedUser, id: string) {
    this.assertTenant(businessId);
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        items: true,
        payments: { orderBy: { paidAt: 'asc' } },
        vendor: true,
      },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found.');
    }
    this.assertBranchAccess(user, purchase);

    const userIds = Array.from(
      new Set([
        ...purchase.payments.map((p) => p.createdBy),
        ...purchase.payments
          .map((p) => p.reversedBy)
          .filter((id): id is string => !!id),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    const validPayments = purchase.payments.filter((p) => !p.reversedAt);
    const amountPaid = validPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const remainingAmount = Number(purchase.totalAmount) - amountPaid;
    const paymentStatus =
      purchase.status !== 'ACTIVE'
        ? null
        : amountPaid <= 0
          ? ('UNPAID' as const)
          : remainingAmount <= 0
            ? ('PAID' as const)
            : ('PARTIAL' as const);

    return {
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      vendorId: purchase.vendorId,
      vendorName: purchase.vendor.businessName,
      outletId: purchase.outletId,
      status: purchase.status,
      purchaseDate: purchase.purchaseDate,
      dueDate: purchase.dueDate,
      totalAmount: purchase.totalAmount,
      amountPaid: amountPaid.toFixed(2),
      remainingAmount: remainingAmount.toFixed(2),
      paymentStatus,
      notes: purchase.notes,
      cancelledAt: purchase.cancelledAt,
      cancelReason: purchase.cancelReason,
      createdAt: purchase.createdAt,
      items: purchase.items.map((i) => ({
        id: i.id,
        itemName: i.itemName,
        description: i.description,
        quantity: i.quantity,
        unitCost: i.unitCost,
        lineTotal: i.lineTotal,
      })),
      payments: purchase.payments.map((p) => ({
        id: p.id,
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
      })),
    };
  }

  // Cancels a purchase — never allowed once money has been recorded against
  // it, since this module has no reversal-of-goods concept (nothing was
  // ever added to inventory to reverse). The record itself is preserved.
  async cancel(
    businessId: string,
    user: AuthenticatedUser,
    id: string,
    dto: CancelPurchaseDto,
  ) {
    this.assertTenant(businessId);
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: { payments: true },
    });
    if (!purchase) {
      throw new NotFoundException('Purchase not found.');
    }
    this.assertBranchAccess(user, purchase);
    if (purchase.status !== 'ACTIVE') {
      throw new BadRequestException(
        'This purchase has already been cancelled.',
      );
    }
    if (purchase.payments.some((p) => !p.reversedAt)) {
      throw new BadRequestException(
        'This purchase has payments recorded against it and cannot be cancelled. Reverse the payments first.',
      );
    }

    return this.prisma.purchase.update({
      where: { id },
      data: {
        status: PurchaseStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: user.userId,
        cancelReason: dto.reason ?? null,
      },
    });
  }

  // "Record Vendor Payment" — a later payment against this specific
  // purchase, made any time after the original purchase.
  async addPayment(
    businessId: string,
    user: AuthenticatedUser,
    id: string,
    dto: CreateVendorPaymentDto,
  ) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { payments: true },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found.');
      }
      this.assertBranchAccess(user, purchase);
      if (purchase.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Payments can only be recorded against an active purchase.',
        );
      }

      const amountPaid = purchase.payments
        .filter((p) => !p.reversedAt)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(purchase.totalAmount) - amountPaid;

      if (dto.amount <= 0) {
        throw new BadRequestException(
          'Payment amount must be greater than zero.',
        );
      }
      if (remaining <= 0) {
        throw new BadRequestException('This purchase is already fully paid.');
      }
      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Payment cannot exceed the remaining balance of ${remaining.toFixed(2)}.`,
        );
      }

      // Guards against an accidental duplicate submit (double-click, a
      // retried request) — an identical amount+method recorded for this
      // same purchase moments ago is almost certainly the same payment.
      const tenSecondsAgo = new Date(Date.now() - 10_000);
      const possibleDuplicate = await tx.vendorPayment.findFirst({
        where: {
          purchaseId: id,
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

      await tx.vendorPayment.create({
        data: {
          businessId,
          vendorId: purchase.vendorId,
          purchaseId: id,
          amount: dto.amount,
          method: dto.method,
          provider: dto.provider ?? null,
          bankName: dto.bankName ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          note: dto.note ?? null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          isInitialPayment: false,
          deductFromDashboardCash: dto.deductFromDashboardCash ?? false,
          createdBy: user.userId,
        },
      });

      const newRemaining = remaining - dto.amount;
      return {
        purchaseId: id,
        amountPaid: amountPaid + dto.amount,
        remainingAmount: newRemaining,
        paymentStatus: newRemaining <= 0 ? 'PAID' : 'PARTIAL',
      };
    });
  }

  // Hard-deletes a purchase bill entirely — distinct from cancel() above,
  // which only marks it CANCELLED and preserves the row. Cascades, inside
  // one transaction, to this bill's own PurchaseItem rows and ONLY the
  // vendor payments linked to this specific purchase (never a different
  // bill's payments, even for the same vendor). The vendor's totals and the
  // dashboard's Available Sales Cash are always computed live from
  // Purchase/VendorPayment (see VendorsService / SalesService.getDashboard),
  // so both reflect this deletion automatically with no separate
  // recalculation step — including reversing any deducted amount.
  async remove(businessId: string, user: AuthenticatedUser, id: string) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId },
      });
      if (!purchase) {
        throw new NotFoundException('Purchase not found.');
      }
      this.assertBranchAccess(user, purchase);

      // Order matters: items and payments (children) before the purchase
      // (parent) they reference, so nothing is ever left dangling.
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.vendorPayment.deleteMany({ where: { purchaseId: id, businessId } });
      await tx.purchase.delete({ where: { id } });

      return { deleted: true };
    });
  }
}
