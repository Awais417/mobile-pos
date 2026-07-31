import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorStatusDto } from './dto/vendor-status.dto';

type VendorWithHistory = Prisma.VendorGetPayload<{
  include: {
    purchases: { include: { items: true } };
    payments: true;
  };
}>;

// Single source of truth for a vendor's financial summary — used by both
// findAll (list) and findOne (detail) so the two views can never drift
// apart. Cancelled purchases (and any payment against one) contribute
// nothing — mirrors how a voided Sale is excluded from client balances.
function computeSummary(vendor: VendorWithHistory) {
  const activePurchases = vendor.purchases.filter((p) => p.status === 'ACTIVE');
  const activePurchaseIds = new Set(activePurchases.map((p) => p.id));

  const itemNames = new Set(
    activePurchases.flatMap((p) => p.items.map((i) => i.itemName)),
  );
  const totalUnits = activePurchases.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );
  const totalPurchaseAmount = activePurchases.reduce(
    (sum, p) => sum + Number(p.totalAmount),
    0,
  );

  const validPayments = vendor.payments.filter(
    (p) => !p.reversedAt && p.purchaseId && activePurchaseIds.has(p.purchaseId),
  );
  const initialPayments = validPayments
    .filter((p) => p.isInitialPayment)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const laterPayments = validPayments
    .filter((p) => !p.isInitialPayment)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = initialPayments + laterPayments;

  return {
    totalPurchaseAmount,
    purchaseBillsCount: activePurchases.length,
    distinctItems: itemNames.size,
    totalUnits,
    initialPayments,
    laterPayments,
    totalPaid,
    remainingPayable: Math.max(totalPurchaseAmount - totalPaid, 0),
  };
}

@Injectable()
export class VendorsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(businessId: string, dto: CreateVendorDto) {
    this.assertTenant(businessId);

    return this.prisma.vendor.create({
      data: {
        businessId,
        businessName: dto.businessName.trim(),
        phone: dto.phone.trim(),
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async findAll(
    businessId: string,
    opts?: { search?: string; includeArchived?: boolean },
  ) {
    this.assertTenant(businessId);

    const q = opts?.search?.trim();
    const vendors = await this.prisma.vendor.findMany({
      where: {
        businessId,
        ...(opts?.includeArchived ? {} : { archivedAt: null }),
        ...(q
          ? {
              OR: [
                { businessName: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        purchases: { include: { items: true } },
        payments: true,
      },
    });

    return vendors.map((v) => {
      const summary = computeSummary(v);
      return {
        id: v.id,
        businessName: v.businessName,
        phone: v.phone,
        address: v.address,
        notes: v.notes,
        isActive: v.isActive,
        archivedAt: v.archivedAt,
        createdAt: v.createdAt,
        totalPurchaseAmount: summary.totalPurchaseAmount.toFixed(2),
        purchaseBillsCount: summary.purchaseBillsCount,
        distinctItems: summary.distinctItems,
        totalUnits: summary.totalUnits,
        totalPaid: summary.totalPaid.toFixed(2),
        remainingPayable: summary.remainingPayable.toFixed(2),
      };
    });
  }

  async findOne(businessId: string, id: string) {
    this.assertTenant(businessId);

    const vendor = await this.prisma.vendor.findFirst({
      where: { id, businessId },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' },
          include: { items: true, payments: true },
        },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    const userIds = Array.from(
      new Set([
        ...vendor.purchases.map((p) => p.createdBy),
        ...vendor.payments.map((p) => p.createdBy),
        ...vendor.payments
          .map((p) => p.reversedBy)
          .filter((id): id is string => !!id),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    const purchases = vendor.purchases.map((p) => {
      const validPayments = p.payments.filter((pay) => !pay.reversedAt);
      const amountPaid = validPayments.reduce(
        (s, pay) => s + Number(pay.amount),
        0,
      );
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
        status: p.status,
        purchaseDate: p.purchaseDate,
        dueDate: p.dueDate,
        distinctItems: new Set(p.items.map((i) => i.itemName)).size,
        totalUnits: p.items.reduce((s, i) => s + i.quantity, 0),
        totalAmount: p.totalAmount,
        amountPaid: amountPaid.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        paymentStatus,
        createdByName: nameMap.get(p.createdBy) ?? 'Unknown',
        createdAt: p.createdAt,
      };
    });

    const payments = vendor.payments.map((p) => ({
      id: p.id,
      purchaseId: p.purchaseId,
      purchaseNumber: p.purchaseId
        ? (vendor.purchases.find((pur) => pur.id === p.purchaseId)
            ?.purchaseNumber ?? null)
        : null,
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

    const summary = computeSummary(vendor);

    return {
      id: vendor.id,
      businessName: vendor.businessName,
      phone: vendor.phone,
      address: vendor.address,
      notes: vendor.notes,
      isActive: vendor.isActive,
      archivedAt: vendor.archivedAt,
      createdAt: vendor.createdAt,
      summary: {
        totalPurchaseAmount: summary.totalPurchaseAmount.toFixed(2),
        purchaseBillsCount: summary.purchaseBillsCount,
        distinctItems: summary.distinctItems,
        totalUnits: summary.totalUnits,
        initialPayments: summary.initialPayments.toFixed(2),
        laterPayments: summary.laterPayments.toFixed(2),
        totalPaid: summary.totalPaid.toFixed(2),
        remainingPayable: summary.remainingPayable.toFixed(2),
      },
      purchases,
      payments,
    };
  }

  async update(businessId: string, id: string, dto: UpdateVendorDto) {
    this.assertTenant(businessId);
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, businessId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    return this.prisma.vendor.update({
      where: { id },
      data: {
        businessName: dto.businessName?.trim(),
        phone: dto.phone?.trim(),
        address:
          dto.address !== undefined ? dto.address?.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
      },
    });
  }

  // Deactivate/reactivate — never a hard delete. A vendor with purchase or
  // payment history stays fully intact; this only flips isActive (hides it
  // from active pickers) and stamps archivedAt/archivedBy for audit.
  async setStatus(
    businessId: string,
    id: string,
    performedBy: string,
    dto: VendorStatusDto,
  ) {
    this.assertTenant(businessId);
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, businessId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }

    return this.prisma.vendor.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        archivedAt: dto.isActive ? null : new Date(),
        archivedBy: dto.isActive ? null : performedBy,
      },
    });
  }

  // Permanently deletes this vendor and every record that belongs to it —
  // distinct from setStatus() above, which only deactivates and always
  // preserves history. Runs as one transaction so a failure at any step
  // rolls back everything. Deletion order is FK-safe (children before
  // parents): PurchaseItem rows, then every VendorPayment for this vendor
  // (this vendor's "cash/ledger" entries — there is no separate ledger
  // table), then every Purchase, then the Vendor itself. The vendor's own
  // totals need no separate recalculation (nothing to compute — the vendor
  // is gone); the dashboard's Available Sales Cash is always computed live
  // from VendorPayment (see SalesService.getDashboard), so deleting these
  // payment rows automatically reverses any deduction they made.
  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id, businessId } });
      if (!vendor) {
        throw new NotFoundException('Vendor not found.');
      }

      const purchases = await tx.purchase.findMany({
        where: { vendorId: id, businessId },
        select: { id: true },
      });
      const purchaseIds = purchases.map((p) => p.id);

      if (purchaseIds.length > 0) {
        await tx.purchaseItem.deleteMany({
          where: { purchaseId: { in: purchaseIds } },
        });
      }
      await tx.vendorPayment.deleteMany({ where: { vendorId: id, businessId } });
      if (purchaseIds.length > 0) {
        await tx.purchase.deleteMany({
          where: { id: { in: purchaseIds }, businessId },
        });
      }
      await tx.vendor.delete({ where: { id } });

      return { deleted: true };
    });
  }

  // Read-only outlet lookup for the branch selector on New Purchase — this
  // app has no outlet management UI yet, so it simply lists whatever Outlet
  // rows already exist for the business (may be empty).
  async listOutlets(businessId: string) {
    this.assertTenant(businessId);
    return this.prisma.outlet.findMany({
      where: { businessId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async assertActiveVendor(
    tx: Prisma.TransactionClient,
    businessId: string,
    vendorId: string,
  ) {
    const vendor = await tx.vendor.findFirst({
      where: { id: vendorId, businessId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }
    if (!vendor.isActive) {
      throw new BadRequestException(
        'This vendor is inactive — reactivate it before recording new purchases or payments.',
      );
    }
    return vendor;
  }
}
