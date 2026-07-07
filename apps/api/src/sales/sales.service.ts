import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

      const sale = await tx.sale.create({
        data: {
          businessId,
          cashierId,
          totalAmount,
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

    let totalRevenue = 0;
    const totalSales = sales.length;
    let totalItemsSold = 0;

    for (const sale of sales) {
      totalRevenue += Number(sale.totalAmount);
      for (const item of sale.items) {
        totalItemsSold += item.quantity;
      }
    }

    return {
      totalSales,
      totalRevenue: totalRevenue.toFixed(2),
      totalItemsSold,
    };
  }
}