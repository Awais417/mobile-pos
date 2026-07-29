import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

type ClientStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'VOIDED' | null;

type SaleWithLedgerData = Prisma.SaleGetPayload<{
  include: { items: true; payments: true; returns: { include: { items: true } } };
}>;

// Remaining Balance = (Total Sale Amount - Total Returned Amount) - Total
// Payments Received. PAID when remaining is 0, PARTIAL when something has
// been paid but a balance remains, UNPAID when nothing has been paid yet.
// A client with no (non-voided) sales at all has nothing to owe, so status
// is null (no purchases yet) rather than a misleading "PAID".
function computeStatus(netAmount: number, totalPaid: number): ClientStatus {
  if (netAmount <= 0) return null;
  const remaining = netAmount - totalPaid;
  if (remaining <= 0) return 'PAID';
  if (totalPaid > 0) return 'PARTIAL';
  return 'UNPAID';
}

// First sold item's name, plus a "+X more" suffix — same convention as
// Sales History's own productSummary(), just server-side here.
function productSummary(items: { productName: string }[]): string {
  if (items.length === 0) return '—';
  const extra = items.length - 1;
  return extra > 0 ? `${items[0].productName} +${extra} more` : items[0].productName;
}

// One row per Payment, in chronological order (by paidAt — the date it was
// actually received, which a later payment may backdate). "Initial" vs
// "Later" is never inferred from that order — it's the isInitialPayment
// flag set once, structurally, the moment the Payment was created (see
// SalesService.create/addPayment) — so a backdated later payment can never
// be mistaken for the checkout-time one. previousBalance/newBalance are a
// running balance against this sale's current net total (after any
// returns), so payment history always reconciles with what the invoice
// shows today.
function buildPaymentRows(
  sale: SaleWithLedgerData,
  netAmount: number,
  nameMap: Map<string, string>,
) {
  const sorted = sale.payments
    .slice()
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  let running = 0;
  return sorted.map((p) => {
    const previousBalance = netAmount - running;
    running += Number(p.amount);
    const newBalance = netAmount - running;
    return {
      id: p.id,
      invoiceNumber: sale.dailyInvoiceNumber,
      saleId: sale.id,
      type: p.isInitialPayment ? ('INITIAL' as const) : ('LATER' as const),
      amount: p.amount,
      method: p.method,
      provider: p.provider,
      bankName: p.bankName,
      note: p.note,
      previousBalance: previousBalance.toFixed(2),
      newBalance: newBalance.toFixed(2),
      receivedByName: nameMap.get(p.receivedBy) ?? 'Unknown',
      paidAt: p.paidAt,
    };
  });
}

// Single source of truth for "what does this one sale currently owe" —
// used by both findAll (client list) and findOne (client detail) so the two
// views can never drift apart. A voided sale contributes nothing (its
// credit-sale entry has been reversed) but is never deleted — it's still
// returned by the caller for history, just excluded from every total below.
function computeSaleMetrics(sale: SaleWithLedgerData) {
  const totalAmount = Number(sale.totalAmount);
  const returnedAmount = sale.returns.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0,
  );
  const netAmount = sale.voidedAt ? 0 : totalAmount - returnedAmount;
  const paidAmount = sale.voidedAt
    ? 0
    : sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = netAmount - paidAmount;
  const status: ClientStatus = sale.voidedAt
    ? 'VOIDED'
    : computeStatus(netAmount, paidAmount);

  return { totalAmount, returnedAmount, netAmount, paidAmount, remainingBalance, status };
}

const saleLedgerInclude = {
  items: true,
  payments: true,
  returns: { include: { items: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class ClientsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Checkout ke dauran naya client add karte waqt — agar isi phone number
  // wala client pehle se maujood hai to naya duplicate record banane ke
  // bajaye wahi purana client wapas kar dete hain (existing: true se pata
  // chal jata hai).
  async create(businessId: string, dto: CreateClientDto) {
    this.assertTenant(businessId);
    const phone = dto.phone.trim();

    const existing = await this.prisma.client.findFirst({
      where: { businessId, phone },
    });
    if (existing) {
      return { ...existing, existing: true };
    }

    const client = await this.prisma.client.create({
      data: {
        businessId,
        fullName: dto.fullName.trim(),
        phone,
        address: dto.address?.trim() || null,
        note: dto.note?.trim() || null,
      },
    });
    return { ...client, existing: false };
  }

  async findAll(
    businessId: string,
    search?: string,
    status?: string,
    includeArchived?: boolean,
  ) {
    this.assertTenant(businessId);

    const q = search?.trim();
    const clients = await this.prisma.client.findMany({
      where: {
        businessId,
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sales: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: saleLedgerInclude,
        },
      },
    });

    const cashierIds = Array.from(
      new Set(clients.flatMap((c) => c.sales.map((s) => s.cashierId))),
    );
    const cashiers = await this.prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, fullName: true },
    });
    const cashierNameMap = new Map(cashiers.map((c) => [c.id, c.fullName]));

    const rows = clients.map((client) => {
      const metrics = client.sales.map((s) => computeSaleMetrics(s));
      const totalAmount = metrics.reduce((sum, m) => sum + m.netAmount, 0);
      const totalPaid = metrics.reduce((sum, m) => sum + m.paidAmount, 0);
      const remainingBalance = totalAmount - totalPaid;

      // A voided sale isn't a real purchase anymore — never surfaced as the
      // "latest purchase" shown on the list row (it still appears in the
      // full purchase history via findOne).
      const activeSales = client.sales.filter((s) => !s.voidedAt);
      const latestSale = activeSales[0];

      return {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        address: client.address,
        note: client.note,
        createdAt: client.createdAt,
        archivedAt: client.archivedAt,
        salesCount: activeSales.length,
        totalAmount: totalAmount.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        remainingBalance: remainingBalance.toFixed(2),
        status: computeStatus(totalAmount, totalPaid),
        latestSale: latestSale
          ? {
              id: latestSale.id,
              date: latestSale.createdAt,
              productSummary: productSummary(latestSale.items),
              salesmanName:
                cashierNameMap.get(latestSale.cashierId) ?? 'Unknown',
            }
          : null,
      };
    });

    if (status && status !== 'ALL') {
      return rows.filter((r) => r.status === status);
    }

    return rows;
  }

  async findOne(businessId: string, id: string) {
    this.assertTenant(businessId);

    const client = await this.prisma.client.findFirst({
      where: { id, businessId },
      include: {
        sales: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: saleLedgerInclude,
        },
      },
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    // One name lookup covers both "sold by" (cashierId) and "received by"
    // (Payment.receivedBy) — same User table, same reason as everywhere else
    // in this app that only stores a raw user id, not a relation.
    const userIds = Array.from(
      new Set([
        ...client.sales.map((s) => s.cashierId),
        ...client.sales.flatMap((s) => s.payments.map((p) => p.receivedBy)),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    const sales = client.sales.map((s) => {
      const m = computeSaleMetrics(s);

      return {
        id: s.id,
        dailyInvoiceNumber: s.dailyInvoiceNumber,
        createdAt: s.createdAt,
        totalAmount: s.totalAmount,
        returnedAmount: m.returnedAmount.toFixed(2),
        netAmount: m.netAmount.toFixed(2),
        paidAmount: m.paidAmount.toFixed(2),
        remainingBalance: m.remainingBalance.toFixed(2),
        status: m.status,
        voidedAt: s.voidedAt,
        paymentMethod: s.paymentMethod,
        salesmanName: nameMap.get(s.cashierId) ?? 'Unknown',
        items: s.items.map((i) => ({
          id: i.id,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          returnedQuantity: i.returnedQuantity,
        })),
        payments: buildPaymentRows(s, m.netAmount, nameMap),
      };
    });

    const totalAmount = sales.reduce((sum, s) => sum + Number(s.netAmount), 0);
    const totalPaid = sales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const remainingBalance = totalAmount - totalPaid;

    // Every payment across every invoice, newest first — the same enriched
    // rows shown nested under each invoice above, just flattened into one
    // list so payments can be scanned across invoices at a glance.
    const paymentHistory = sales
      .flatMap((s) => s.payments)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

    return {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      address: client.address,
      note: client.note,
      createdAt: client.createdAt,
      archivedAt: client.archivedAt,
      totalAmount: totalAmount.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      remainingBalance: remainingBalance.toFixed(2),
      status: computeStatus(totalAmount, totalPaid),
      sales,
      paymentHistory,
    };
  }

  // Deletes (soft) a client — only ever allowed once every linked sale has
  // no remaining balance AND the aggregate outstanding balance is exactly 0.
  // Never touches Sale/Payment/SaleReturn/ProductUnit rows: this only sets
  // archivedAt/archivedBy on the Client itself, inside a transaction so the
  // balance check and the write can never race against a concurrent payment.
  async archive(businessId: string, id: string, performedBy: string) {
    this.assertTenant(businessId);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { id, businessId },
        include: {
          sales: {
            where: { deletedAt: null },
            include: saleLedgerInclude,
          },
        },
      });
      if (!client) {
        throw new NotFoundException('Client not found.');
      }
      if (client.archivedAt) {
        throw new BadRequestException('This client has already been deleted.');
      }

      // Client Outstanding Balance = Valid Credit Sales - Valid Payments -
      // Returns (this schema has no "Opening Balance"/"Approved Adjustment"
      // concept — computeSaleMetrics already nets out returns and excludes
      // voided sales, the only two adjustment types that exist here).
      let totalOutstanding = 0;
      for (const sale of client.sales) {
        const m = computeSaleMetrics(sale);
        const remaining = Math.round(m.remainingBalance * 100) / 100;
        if (remaining !== 0) {
          throw new BadRequestException(
            `Client cannot be deleted because an outstanding balance of PKR ${remaining.toFixed(2)} remains on invoice #${sale.dailyInvoiceNumber}.`,
          );
        }
        totalOutstanding += remaining;
      }
      totalOutstanding = Math.round(totalOutstanding * 100) / 100;
      if (totalOutstanding !== 0) {
        throw new BadRequestException(
          `Client cannot be deleted because an outstanding balance of PKR ${totalOutstanding.toFixed(2)} remains.`,
        );
      }

      return tx.client.update({
        where: { id },
        data: { archivedAt: new Date(), archivedBy: performedBy },
      });
    });
  }

  // Business-wide cash-collection snapshot for the Dashboard — deliberately
  // NOT scoped to any date range, since "how much is still owed right now"
  // is a running balance, not something that resets per period. Reuses
  // findAll()'s own per-client math (already nets out returns and excludes
  // voided sales) rather than re-deriving the same figures a second way.
  async getReceivablesSummary(businessId: string) {
    this.assertTenant(businessId);
    const clients = await this.findAll(businessId);

    const totalOutstandingReceivable = clients.reduce(
      (sum, c) => sum + Math.max(Number(c.remainingBalance), 0),
      0,
    );
    const totalCollectedAllTime = clients.reduce(
      (sum, c) => sum + Number(c.totalPaid),
      0,
    );

    return {
      totalOutstandingReceivable: totalOutstandingReceivable.toFixed(2),
      totalCollectedAllTime: totalCollectedAllTime.toFixed(2),
    };
  }

  async update(businessId: string, id: string, dto: UpdateClientDto) {
    this.assertTenant(businessId);

    const client = await this.prisma.client.findFirst({
      where: { id, businessId },
    });
    if (!client) {
      throw new NotFoundException('Client not found.');
    }

    if (dto.phone) {
      const phone = dto.phone.trim();
      const duplicate = await this.prisma.client.findFirst({
        where: { businessId, phone, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException(
          `This phone number already belongs to ${duplicate.fullName}.`,
        );
      }
    }

    return this.prisma.client.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        phone: dto.phone?.trim(),
        address:
          dto.address !== undefined ? dto.address?.trim() || null : undefined,
        note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
      },
    });
  }
}
