import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import {
  computeAvailabilityMap,
  isInStock,
} from '../common/product-availability.util';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // productCount reflects the exact same "actually in stock" rule as
  // Products Page / POS / Category counts (see product-availability.util) —
  // never a raw count of every Product row ever linked to this model. A
  // model whose only products have all sold out or been archived must show
  // 0 here, the same way its category and the Products Page already would.
  //
  // `isActive` on the row is a manually-managed flag — set by an explicit
  // Deactivate/Reactivate action, or automatically to false the one time
  // Delete is attempted while products still reference it (see remove()
  // below). It is NEVER written here and never derived from stock, so
  // manual archive/reactivate and historical model references (Sales
  // History, invoices, reports) keep exactly the value an admin set.
  //
  // `displayIsActive` is a separate, response-only field: true only when
  // this model currently has at least one active product with available
  // stock (productCount > 0). The Category page's "is this model active"
  // display/filtering must read this field, not the raw `isActive` column —
  // otherwise a model whose last unit just sold out would keep reading as
  // "Active" (isActive: true) despite productCount: 0, which is exactly the
  // contradictory state this field exists to avoid.
  async findAll(
    businessId: string,
    options?: { categoryId?: string; activeOnly?: boolean },
  ) {
    this.assertTenant(businessId);
    // activeOnly is applied after computing displayIsActive below, not as a
    // DB-level filter — "active" for callers of this endpoint means the
    // stock-aware status, not the raw isActive column.
    const models = await this.prisma.model.findMany({
      where: {
        businessId,
        ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      },
      orderBy: { name: 'asc' },
    });

    const modelIds = models.map((m) => m.id);
    const products = modelIds.length
      ? await this.prisma.product.findMany({
          where: { businessId, isActive: true, modelId: { in: modelIds } },
          select: {
            id: true,
            modelId: true,
            isSerialized: true,
            stockQty: true,
          },
        })
      : [];
    const availabilityMap = await computeAvailabilityMap(
      this.prisma,
      businessId,
      products,
    );
    const inStockCountByModel = new Map<string, number>();
    for (const p of products) {
      if (!p.modelId || !isInStock(p, availabilityMap.get(p.id))) continue;
      inStockCountByModel.set(
        p.modelId,
        (inStockCountByModel.get(p.modelId) ?? 0) + 1,
      );
    }

    const withCounts = models.map((m) => {
      const productCount = inStockCountByModel.get(m.id) ?? 0;
      return {
        ...m,
        productCount,
        displayIsActive: productCount > 0,
      };
    });

    return options?.activeOnly
      ? withCounts.filter((m) => m.displayIsActive)
      : withCounts;
  }

  async create(businessId: string, dto: CreateModelDto) {
    this.assertTenant(businessId);

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, businessId },
    });
    if (!category) {
      throw new BadRequestException('Selected category was not found.');
    }
    if (!category.isSerialized) {
      throw new BadRequestException(
        'Models can only be added under a serialized (device) category.',
      );
    }

    const existing = await this.prisma.model.findFirst({
      where: {
        categoryId: dto.categoryId,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This model already exists under the selected category.',
      );
    }

    return this.prisma.model.create({
      data: { businessId, categoryId: dto.categoryId, name: dto.name },
    });
  }

  // categoryId qasdan yahan editable nahi — model ko galat category mein daal
  // dena chahiye ho to naya model banayein, purana deactivate kar dein.
  async update(businessId: string, id: string, dto: UpdateModelDto) {
    this.assertTenant(businessId);
    const model = await this.prisma.model.findFirst({
      where: { id, businessId },
    });
    if (!model) {
      throw new NotFoundException('Model not found.');
    }

    if (dto.name !== undefined && dto.name !== model.name) {
      const existing = await this.prisma.model.findFirst({
        where: {
          categoryId: model.categoryId,
          name: { equals: dto.name, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          'This model already exists under the selected category.',
        );
      }
    }

    return this.prisma.model.update({
      where: { id },
      data: { name: dto.name, isActive: dto.isActive },
    });
  }

  // Products wale model permanently delete nahi hota — archive (isActive:false)
  // ho jaata hai, taake in-use products apna model kabhi na khoyein.
  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);
    const model = await this.prisma.model.findFirst({
      where: { id, businessId },
    });
    if (!model) {
      throw new NotFoundException('Model not found.');
    }

    const productCount = await this.prisma.product.count({
      where: { modelId: id },
    });

    if (productCount > 0) {
      await this.prisma.model.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        archived: true,
        message:
          'This model is being used by products and has been archived instead of deleted.',
      };
    }

    await this.prisma.model.delete({ where: { id } });
    return { archived: false, message: 'Model deleted successfully.' };
  }
}
