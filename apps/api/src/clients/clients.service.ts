import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, ClientHistoryEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const HISTORY_ENTRY_TYPES = ['SALE', 'PAYMENT', 'RETURN'] as const;

type ClientStatus =
  'PAID' | 'PARTIAL' | 'UNPAID' | 'VOIDED' | 'RETURNED' | 'REFUND_DUE' | null;

type SaleWithLedgerData = Prisma.SaleGetPayload<{
  include: {
    items: true;
    payments: true;
    returns: { include: { items: true } };
    refunds: true;
  };
}>;

const ZERO = new Prisma.Decimal(0);

// Remaining Balance = (Total Sale Amount - Total Returned Amount) - Total
// Payments Received. PAID when remaining is 0, PARTIAL when something has
// been paid but a balance remains, UNPAID when nothing has been paid yet.
// A client with no (non-voided) sales at all has nothing to owe, so status
// is null (no purchases yet) rather than a misleading "PAID".
function computeStatus(
  netAmount: Prisma.Decimal,
  totalPaid: Prisma.Decimal,
): ClientStatus {
  if (netAmount.lte(0)) return null;
  const remaining = netAmount.sub(totalPaid);
  if (remaining.lte(0)) return 'PAID';
  if (totalPaid.gt(0)) return 'PARTIAL';
  return 'UNPAID';
}

// Client-level (aggregate, across every one of their sales) status. Built
// from the already-floored per-sale sums below — never re-derives a signed
// balance from raw totals, so a credit on one invoice can never silently
// offset a debt on another (that cross-sale netting was the original bug).
function computeClientStatus(
  totalAmount: Prisma.Decimal,
  totalDue: Prisma.Decimal,
  totalPaid: Prisma.Decimal,
  totalRefundDue: Prisma.Decimal,
): ClientStatus {
  if (totalAmount.lte(0) && totalRefundDue.lte(0)) return null;
  if (totalRefundDue.gt(0) && totalDue.lte(0)) return 'REFUND_DUE';
  if (totalDue.lte(0)) return 'PAID';
  if (totalPaid.gt(0)) return 'PARTIAL';
  return 'UNPAID';
}

// First sold item's name, plus a "+X more" suffix — same convention as
// Sales History's own productSummary(), just server-side here.
function productSummary(items: { productName: string }[]): string {
  if (items.length === 0) return '—';
  const extra = items.length - 1;
  return extra > 0
    ? `${items[0].productName} +${extra} more`
    : items[0].productName;
}

// One row per Payment, in chronological order (by paidAt — the date it was
// actually received, which a later payment may backdate). "Initial" vs
// "Later" vs "Refund" is never inferred from that order — it's the
// isInitialPayment/isRefund flags set once, structurally, the moment the
// Payment was created (see SalesService.create/addPayment/returnItems) —
// so a backdated later payment can never be mistaken for the checkout-time
// one, and a refund (negative amount) is always labeled as such.
// previousBalance/newBalance are a running balance against this sale's
// current net total (after any returns), so payment history always
// reconciles with what the invoice shows today — a refund row correctly
// shows the balance moving back up.
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
      type: p.isRefund
        ? ('REFUND' as const)
        : p.isInitialPayment
          ? ('INITIAL' as const)
          : ('LATER' as const),
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

// One row per SaleReturn (a client may return several items from the same
// sale in one visit), newest first — the actual "items returned" event,
// distinct from paymentHistory/refunds (money movements). Carries its own
// refund settlement, if the return left one, so the Returns tab can show
// both together without a second lookup.
function buildReturnRows(
  sale: SaleWithLedgerData,
  nameMap: Map<string, string>,
) {
  const itemNameById = new Map(sale.items.map((i) => [i.id, i.productName]));
  return sale.returns.map((ret) => {
    const refund = sale.refunds.find((r) => r.saleReturnId === ret.id) ?? null;
    return {
      id: ret.id,
      saleId: sale.id,
      dailyInvoiceNumber: sale.dailyInvoiceNumber,
      reason: ret.reason,
      performedByName: nameMap.get(ret.performedBy) ?? 'Unknown',
      totalAmount: ret.totalAmount,
      createdAt: ret.createdAt,
      items: ret.items.map((i) => ({
        id: i.id,
        productName: itemNameById.get(i.saleItemId) ?? 'Unknown item',
        quantity: i.quantity,
        amount: i.amount,
      })),
      refund: refund
        ? {
            id: refund.id,
            amount: refund.amount,
            status: refund.status,
            method: refund.method,
            referenceNumber: refund.referenceNumber,
            note: refund.note,
            createdAt: refund.createdAt,
            createdByName: nameMap.get(refund.createdBy) ?? 'Unknown',
            completedAt: refund.completedAt,
            completedByName: refund.completedBy
              ? (nameMap.get(refund.completedBy) ?? 'Unknown')
              : null,
          }
        : null,
    };
  });
}

// Single source of truth for "what does this one sale currently owe, and
// what (if anything) is owed back to the customer" — used by findAll,
// findOne and archive so every view stays in agreement. A voided sale
// contributes nothing (its credit-sale entry has been reversed) but is
// never deleted — it's still returned by the caller for history, just
// excluded from every total below.
//
// customerDue and refundDue are both floored at zero — a sale can owe the
// shop money OR owe the customer a refund, never both, and neither is ever
// shown as a negative number. paidAmount already nets out any completed
// refund automatically: a refund is stored as a Payment row with a
// NEGATIVE amount (see Payment.isRefund), so summing every Payment row
// here is exactly "Total Customer Payments − Completed Cash Refunds" with
// no special-casing needed.
function computeSaleMetrics(sale: SaleWithLedgerData) {
  const totalAmount = sale.totalAmount;
  const returnedAmount = sale.returns.reduce(
    (sum, r) => sum.add(r.totalAmount),
    ZERO,
  );
  const netAmount = sale.voidedAt ? ZERO : totalAmount.sub(returnedAmount);
  const paidAmount = sale.voidedAt
    ? ZERO
    : sale.payments.reduce((sum, p) => sum.add(p.amount), ZERO);

  const rawDue = netAmount.sub(paidAmount);
  const remainingBalance = rawDue.gt(0) ? rawDue : ZERO;
  const refundDue = rawDue.lt(0) ? rawDue.neg() : ZERO;

  let status: ClientStatus;
  if (sale.voidedAt) {
    status = 'VOIDED';
  } else if (refundDue.gt(0)) {
    status = 'REFUND_DUE';
  } else if (netAmount.lte(0) && returnedAmount.gt(0)) {
    status = 'RETURNED';
  } else {
    status = computeStatus(netAmount, paidAmount);
  }

  return {
    totalAmount,
    returnedAmount,
    netAmount,
    paidAmount,
    remainingBalance,
    refundDue,
    status,
  };
}

const saleLedgerInclude = {
  items: true,
  payments: true,
  returns: { include: { items: true } },
  refunds: true,
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
      const totalAmount = metrics.reduce(
        (sum, m) => sum.add(m.netAmount),
        ZERO,
      );
      const totalPaid = metrics.reduce((sum, m) => sum.add(m.paidAmount), ZERO);
      // Sum the already-floored per-sale amounts — never re-derive a single
      // signed balance from raw totals (that cross-sale netting was the bug:
      // a refund credit on one invoice must never reduce the due shown for
      // a completely different invoice).
      const totalDue = metrics.reduce(
        (sum, m) => sum.add(m.remainingBalance),
        ZERO,
      );
      const totalRefundDue = metrics.reduce(
        (sum, m) => sum.add(m.refundDue),
        ZERO,
      );

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
        remainingBalance: totalDue.toFixed(2),
        refundDue: totalRefundDue.toFixed(2),
        status: computeClientStatus(
          totalAmount,
          totalDue,
          totalPaid,
          totalRefundDue,
        ),
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

    // One name lookup covers "sold by" (cashierId), "received by"
    // (Payment.receivedBy) and refund created/completed by — same User
    // table, same reason as everywhere else in this app that only stores a
    // raw user id, not a relation.
    const userIds = Array.from(
      new Set([
        ...client.sales.map((s) => s.cashierId),
        ...client.sales.flatMap((s) => s.payments.map((p) => p.receivedBy)),
        ...client.sales.flatMap((s) => s.refunds.map((r) => r.createdBy)),
        ...client.sales.flatMap((s) =>
          s.refunds.map((r) => r.completedBy).filter((v): v is string => !!v),
        ),
      ]),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    const metrics = client.sales.map((s) => computeSaleMetrics(s));

    const sales = client.sales.map((s, idx) => {
      const m = metrics[idx];

      return {
        id: s.id,
        dailyInvoiceNumber: s.dailyInvoiceNumber,
        createdAt: s.createdAt,
        totalAmount: s.totalAmount,
        returnedAmount: m.returnedAmount.toFixed(2),
        netAmount: m.netAmount.toFixed(2),
        paidAmount: m.paidAmount.toFixed(2),
        remainingBalance: m.remainingBalance.toFixed(2),
        refundDue: m.refundDue.toFixed(2),
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
        payments: buildPaymentRows(s, Number(m.netAmount), nameMap),
      };
    });

    const totalAmount = metrics.reduce((sum, m) => sum.add(m.netAmount), ZERO);
    const totalPaid = metrics.reduce((sum, m) => sum.add(m.paidAmount), ZERO);
    const totalDue = metrics.reduce(
      (sum, m) => sum.add(m.remainingBalance),
      ZERO,
    );
    const totalRefundDue = metrics.reduce(
      (sum, m) => sum.add(m.refundDue),
      ZERO,
    );

    // Every payment across every invoice, newest first — the same enriched
    // rows shown nested under each invoice above, just flattened into one
    // list so payments can be scanned across invoices at a glance.
    const paymentHistory = sales
      .flatMap((s) => s.payments)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

    // Refund settlement history — Refund Now (COMPLETED immediately) and
    // Refund Later (PENDING until settled via completeRefund). Deliberately
    // separate from paymentHistory: this is money the shop owes/paid to the
    // customer, the opposite direction of the Payment ledger above.
    const refunds = client.sales
      .flatMap((s) =>
        s.refunds.map((r) => ({
          id: r.id,
          saleId: s.id,
          dailyInvoiceNumber: s.dailyInvoiceNumber,
          amount: r.amount,
          status: r.status,
          method: r.method,
          referenceNumber: r.referenceNumber,
          note: r.note,
          createdAt: r.createdAt,
          createdByName: nameMap.get(r.createdBy) ?? 'Unknown',
          completedAt: r.completedAt,
          completedByName: r.completedBy
            ? (nameMap.get(r.completedBy) ?? 'Unknown')
            : null,
        })),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Actual "items returned" events — separate from refunds (money
    // movements) above; each carries its own refund settlement (if any) so
    // the Returns tab needs only this one list.
    const returns = client.sales
      .flatMap((s) => buildReturnRows(s, nameMap))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Client History visibility — hides a Sale/Payment/Return row from this
    // response only. Totals above are already computed from the FULL,
    // unfiltered data, so a hidden entry never changes what the header
    // shows; only the row-level lists below are curated for display.
    const hides = await this.prisma.clientHistoryHide.findMany({
      where: { businessId, clientId: id },
      select: { entryType: true, entryId: true },
    });
    const hiddenKey = (type: ClientHistoryEntryType, entryId: string) =>
      `${type}:${entryId}`;
    const hiddenSet = new Set(hides.map((h) => hiddenKey(h.entryType, h.entryId)));

    const visibleSales = sales
      .filter((s) => !hiddenSet.has(hiddenKey('SALE', s.id)))
      .map((s) => ({
        ...s,
        payments: s.payments.filter(
          (p) => !hiddenSet.has(hiddenKey('PAYMENT', p.id)),
        ),
      }));
    const visiblePaymentHistory = paymentHistory.filter(
      (p) => !hiddenSet.has(hiddenKey('PAYMENT', p.id)),
    );
    const visibleReturns = returns.filter(
      (r) => !hiddenSet.has(hiddenKey('RETURN', r.id)),
    );

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
      remainingBalance: totalDue.toFixed(2),
      refundDue: totalRefundDue.toFixed(2),
      status: computeClientStatus(
        totalAmount,
        totalDue,
        totalPaid,
        totalRefundDue,
      ),
      sales: visibleSales,
      paymentHistory: visiblePaymentHistory,
      refunds,
      returns: visibleReturns,
    };
  }

  // Every Sale/Payment/Return id currently visible for this client (i.e.
  // linked to them and not already hidden) — shared by hideHistoryEntry's
  // ownership check and clearHistory's "hide everything visible" sweep.
  private async loadVisibleHistoryIds(businessId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, businessId },
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

    const saleIds = client.sales.map((s) => s.id);
    const paymentIds = client.sales.flatMap((s) => s.payments.map((p) => p.id));
    const returnIds = client.sales.flatMap((s) => s.returns.map((r) => r.id));

    return { saleIds, paymentIds, returnIds };
  }

  // Hides one Sale/Payment/Return row from this client's History tabs —
  // never touches the underlying record (see ClientHistoryHide's schema
  // comment). Ownership is re-verified here (entryId must actually belong
  // to this client/business) so one client's history can never be used to
  // hide another client's — or another business's — data.
  async hideHistoryEntry(
    businessId: string,
    clientId: string,
    entryType: string,
    entryId: string,
    reason: string,
    hiddenBy: string,
  ) {
    this.assertTenant(businessId);
    if (!HISTORY_ENTRY_TYPES.includes(entryType as (typeof HISTORY_ENTRY_TYPES)[number])) {
      throw new BadRequestException('Invalid history entry type.');
    }
    const type = entryType as ClientHistoryEntryType;

    const { saleIds, paymentIds, returnIds } = await this.loadVisibleHistoryIds(
      businessId,
      clientId,
    );
    const belongsToClient =
      (type === 'SALE' && saleIds.includes(entryId)) ||
      (type === 'PAYMENT' && paymentIds.includes(entryId)) ||
      (type === 'RETURN' && returnIds.includes(entryId));
    if (!belongsToClient) {
      throw new NotFoundException('This history entry was not found for this client.');
    }

    await this.prisma.clientHistoryHide.upsert({
      where: {
        businessId_entryType_entryId: { businessId, entryType: type, entryId },
      },
      update: { reason, hiddenBy, hiddenAt: new Date() },
      create: { businessId, clientId, entryType: type, entryId, reason, hiddenBy },
    });

    return { hidden: true };
  }

  // "Clear Client History" — hides every currently-visible Sale/Payment/
  // Return row for this client in one action. Same mechanism as
  // hideHistoryEntry, just applied in bulk; skipDuplicates makes this safe
  // to call again without erroring on rows already hidden.
  async clearHistory(
    businessId: string,
    clientId: string,
    reason: string,
    hiddenBy: string,
  ) {
    this.assertTenant(businessId);
    const { saleIds, paymentIds, returnIds } = await this.loadVisibleHistoryIds(
      businessId,
      clientId,
    );

    const rows: Prisma.ClientHistoryHideCreateManyInput[] = [
      ...saleIds.map((entryId) => ({
        businessId,
        clientId,
        entryType: 'SALE' as ClientHistoryEntryType,
        entryId,
        reason,
        hiddenBy,
      })),
      ...paymentIds.map((entryId) => ({
        businessId,
        clientId,
        entryType: 'PAYMENT' as ClientHistoryEntryType,
        entryId,
        reason,
        hiddenBy,
      })),
      ...returnIds.map((entryId) => ({
        businessId,
        clientId,
        entryType: 'RETURN' as ClientHistoryEntryType,
        entryId,
        reason,
        hiddenBy,
      })),
    ];

    if (rows.length > 0) {
      await this.prisma.clientHistoryHide.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }

    return { cleared: rows.length };
  }

  // Deletes (soft) a client — only ever allowed once every linked sale has
  // no remaining balance AND no refund still owed to the customer (a
  // pending "Refund Later" blocks archiving just like an outstanding
  // balance does — this is still unfinished business with this client).
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
      let totalDue = ZERO;
      let totalRefundDue = ZERO;
      for (const sale of client.sales) {
        const m = computeSaleMetrics(sale);
        if (m.remainingBalance.gt(0)) {
          throw new BadRequestException(
            `This client cannot be deleted until the outstanding balance is fully cleared. PKR ${m.remainingBalance.toFixed(2)} remains on invoice #${sale.dailyInvoiceNumber}.`,
          );
        }
        if (m.refundDue.gt(0)) {
          throw new BadRequestException(
            `Client cannot be deleted because a refund of PKR ${m.refundDue.toFixed(2)} is still owed to them on invoice #${sale.dailyInvoiceNumber}.`,
          );
        }
        totalDue = totalDue.add(m.remainingBalance);
        totalRefundDue = totalRefundDue.add(m.refundDue);
      }
      if (totalDue.gt(0)) {
        throw new BadRequestException(
          `This client cannot be deleted until the outstanding balance is fully cleared. PKR ${totalDue.toFixed(2)} remains.`,
        );
      }
      if (totalRefundDue.gt(0)) {
        throw new BadRequestException(
          `Client cannot be deleted because a refund of PKR ${totalRefundDue.toFixed(2)} is still owed to them.`,
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
  // findAll()'s own per-client math (already nets out returns/refunds and
  // excludes voided sales) rather than re-deriving the same figures a
  // second way. remainingBalance is already floored at zero per client, so
  // no extra Math.max is needed here anymore.
  async getReceivablesSummary(businessId: string) {
    this.assertTenant(businessId);
    const clients = await this.findAll(businessId);

    const totalOutstandingReceivable = clients.reduce(
      (sum, c) => sum + Number(c.remainingBalance),
      0,
    );
    const totalCollectedAllTime = clients.reduce(
      (sum, c) => sum + Number(c.totalPaid),
      0,
    );
    // Additive — money the shop owes customers (Refund Later, not yet paid
    // out), kept entirely separate from Outstanding Receivable above.
    const totalRefundPayable = clients.reduce(
      (sum, c) => sum + Number(c.refundDue),
      0,
    );

    return {
      totalOutstandingReceivable: totalOutstandingReceivable.toFixed(2),
      totalCollectedAllTime: totalCollectedAllTime.toFixed(2),
      totalRefundPayable: totalRefundPayable.toFixed(2),
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
