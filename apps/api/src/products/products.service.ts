import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(businessId: string) {
    this.assertTenant(businessId);
    return this.prisma.product.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(businessId: string, dto: CreateProductDto) {
    this.assertTenant(businessId);
    return this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        stockQty: dto.stockQty ?? 0,
        reorderLevel: dto.reorderLevel ?? 0,
        categoryId: dto.categoryId,
      },
    });
  }
  
  async update(
    businessId: string,
    id: string,
    dto: import('./dto/update-product.dto').UpdateProductDto,
  ) {
    this.assertTenant(businessId);
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        barcode: dto.barcode,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        stockQty: dto.stockQty,
        reorderLevel: dto.reorderLevel,
      },
    });
  }

  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }
}