import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

// Manually-entered Finance/Dashboard expenses only — created solely through
// the admin's explicit "Subtract Expense" submission. Never touches Sale,
// Product, or ProductUnit rows, and nothing here ever runs automatically.
@Injectable()
export class ExpensesService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(businessId: string, userId: string, dto: CreateExpenseDto) {
    this.assertTenant(businessId);
    return this.prisma.expense.create({
      data: {
        businessId,
        amount: dto.amount,
        title: dto.title.trim(),
        note: dto.note?.trim() || null,
        date: new Date(dto.date),
        createdBy: userId,
      },
    });
  }

  // Expense.createdBy is a plain user id (no Prisma relation) — same reason
  // and same fix as SalesService.findAll()'s cashierNameMap: resolve names
  // via one extra lookup query rather than a relation.
  async findAll(businessId: string) {
    this.assertTenant(businessId);
    const expenses = await this.prisma.expense.findMany({
      where: { businessId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const userIds = Array.from(new Set(expenses.map((e) => e.createdBy)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    return expenses.map((e) => ({
      ...e,
      createdByName: nameMap.get(e.createdBy) ?? 'Unknown',
    }));
  }

  async update(businessId: string, id: string, dto: UpdateExpenseDto) {
    this.assertTenant(businessId);
    const expense = await this.prisma.expense.findFirst({
      where: { id, businessId },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }
    return this.prisma.expense.update({
      where: { id },
      data: {
        amount: dto.amount,
        title: dto.title?.trim(),
        note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);
    const expense = await this.prisma.expense.findFirst({
      where: { id, businessId },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }
    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Expense deleted successfully.' };
  }

  // Today/Weekly/Monthly/Overall Sales, Expenses, and the resulting Net
  // Sales — all computed here, server-side, so every refresh, every
  // logged-in user, and every add/edit/delete of an expense sees the exact
  // same numbers. Sales totals are read the same way SalesService already
  // sums totalAmount (including archived sales — see SalesService.getSummary
  // for why archived sales must still count), just scoped to the matching
  // date range each time (undefined = no lower bound = Overall/all-time).
  // This never writes to Sale and never changes how Total Sales itself is
  // calculated elsewhere — it only reads it.
  async getSummary(businessId: string) {
    this.assertTenant(businessId);

    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Calendar week (Sunday-based), same boundary used by Sales History's
    // own "This Week" filter.
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const ranges: Record<
      'today' | 'weekly' | 'monthly' | 'overall',
      Date | undefined
    > = {
      today: todayStart,
      weekly: weekStart,
      monthly: monthStart,
      overall: undefined,
    };

    const periodTotals = async (
      from: Date | undefined,
    ): Promise<{ sales: number; expenses: number }> => {
      const [salesAgg, expenseAgg] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { businessId, ...(from ? { createdAt: { gte: from } } : {}) },
          _sum: { totalAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: { businessId, ...(from ? { date: { gte: from } } : {}) },
          _sum: { amount: true },
        }),
      ]);
      return {
        sales: Number(salesAgg._sum.totalAmount ?? 0),
        expenses: Number(expenseAgg._sum.amount ?? 0),
      };
    };

    const [today, weekly, monthly, overall] = await Promise.all([
      periodTotals(ranges.today),
      periodTotals(ranges.weekly),
      periodTotals(ranges.monthly),
      periodTotals(ranges.overall),
    ]);

    const build = (t: { sales: number; expenses: number }) => ({
      sales: t.sales.toFixed(2),
      expenses: t.expenses.toFixed(2),
      net: (t.sales - t.expenses).toFixed(2),
    });

    return {
      today: build(today),
      weekly: build(weekly),
      monthly: build(monthly),
      overall: build(overall),
    };
  }
}
