import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import {
  computeAvailabilityMap,
  isInStock,
} from '../common/product-availability.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CategoriesService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // productCount reflects the exact same "actually in stock" rule as the
  // Products Page / POS (see product-availability.util) — never a plain
  // "how many Product rows point at this category" count, so a category's
  // number always matches what an admin would actually see if they filtered
  // the Products Page down to it.
  async findAll(businessId: string, options?: { activeOnly?: boolean }) {
    this.assertTenant(businessId);
    const categories = await this.prisma.category.findMany({
      where: {
        businessId,
        ...(options?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    });

    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, categoryId: true, isSerialized: true, stockQty: true },
    });
    const availabilityMap = await computeAvailabilityMap(
      this.prisma,
      businessId,
      products,
    );
    const inStockCountByCategory = new Map<string, number>();
    for (const p of products) {
      if (!p.categoryId || !isInStock(p, availabilityMap.get(p.id))) continue;
      inStockCountByCategory.set(
        p.categoryId,
        (inStockCountByCategory.get(p.categoryId) ?? 0) + 1,
      );
    }

    return categories.map((c) => ({
      ...c,
      productCount: inStockCountByCategory.get(c.id) ?? 0,
    }));
  }

  async create(businessId: string, dto: CreateCategoryDto) {
    this.assertTenant(businessId);

    const existing = await this.prisma.category.findFirst({
      where: { businessId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('This category already exists.');
    }

    return this.prisma.category.create({
      data: {
        businessId,
        name: dto.name,
        description: dto.description,
        slug: dto.slug || slugify(dto.name),
        isSerialized: dto.isSerialized ?? false,
      },
    });
  }

  async update(businessId: string, id: string, dto: UpdateCategoryDto) {
    this.assertTenant(businessId);
    const category = await this.prisma.category.findFirst({
      where: { id, businessId },
    });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    if (
      dto.name !== undefined &&
      dto.name.toLowerCase() !== category.name.toLowerCase()
    ) {
      const existing = await this.prisma.category.findFirst({
        where: {
          businessId,
          name: { equals: dto.name, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException('This category already exists.');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        slug: dto.slug,
        isSerialized: dto.isSerialized,
        isActive: dto.isActive,
      },
    });
  }

  // Category hamesha permanently delete hoti hai — kabhi block nahi hoti.
  // Model.categoryId aur Product.categoryId dono `onDelete: SetNull` hain
  // (schema.prisma), isliye category delete hote hi Postgres khud unke
  // categoryId ko null kar deta hai — Models, Products, Inventory, IMEIs,
  // Sales History mein se kuch bhi delete nahi hota, sirf category ka link
  // chala jaata hai. Tenant-check + delete ek hi transaction mein.
  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id, businessId },
      });
      if (!category) {
        throw new NotFoundException('Category not found.');
      }

      await tx.category.delete({ where: { id } });
      return { message: 'Category deleted successfully.' };
    });
  }
}
