import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import {
  computeAvailabilityMap,
  isInStock,
} from '../common/product-availability.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { ListProductsDto } from './dto/list-products.dto';

@Injectable()
export class ProductsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(
    businessId: string,
    role?: string,
    options?: { includeArchived?: boolean; inStockOnly?: boolean },
  ) {
    this.assertTenant(businessId);
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        ...(options?.includeArchived ? {} : { isActive: true }),
      },
      include: { category: true, model: true },
      orderBy: { createdAt: 'desc' },
    });

    // POS ke liye — serialized product (phone) ka "stock" Product.stockQty se
    // nahi, uske IN_STOCK ProductUnits ke count se pata chalta hai. Ek hi
    // bounded groupBy query (is business ke serialized products tak limited),
    // N+1 nahi — chahe catalogue mein kitne bhi products hon.
    const availabilityMap = await computeAvailabilityMap(
      this.prisma,
      businessId,
      products,
    );

    let withAvailability = products.map((p) => ({
      ...p,
      availableUnits: p.isSerialized
        ? (availabilityMap.get(p.id) ?? 0)
        : undefined,
    }));

    // POS/selling surfaces ask for inStockOnly — sold-out products (0 available
    // IMEI/serial units, or stockQty<=0 accessories) disappear automatically.
    // The Product/Inventory record itself is never touched here, only excluded
    // from this response; it reappears the moment stock is added again.
    if (options?.inStockOnly) {
      withAvailability = withAvailability.filter((p) =>
        isInStock(p, p.availableUnits),
      );
    }

    // Salesman also sees Cost Price here (POS Terminal's current-sale cart)
    // — unlike the customer-facing receipt, which stays ADMIN-only (see
    // sales.service.ts). Every other role still gets it hidden.
    if (role !== 'ADMIN' && role !== 'SALESMAN') {
      return withAvailability.map((p) => ({ ...p, costPrice: null }));
    }
    return withAvailability;
  }

  // Products Page (admin catalogue) ke liye — server-side paginated, searched,
  // filtered, sorted listing. One row PER PRODUCT (not per unit): Stock is an
  // aggregate — COUNT of IN_STOCK units for serialized products, stockQty for
  // accessories. A unit_stats CTE pre-aggregates ProductUnit once per product
  // so pagination/sort/filter all happen in the database, never in-memory —
  // this is what lets the page stay fast at hundreds/thousands of products.
  // Zero-stock and inactive products never appear here.
  async findCatalogPage(
    businessId: string,
    role: string | undefined,
    query: ListProductsDto,
  ) {
    this.assertTenant(businessId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const search = query.search?.trim();
    const searchPattern = search ? `%${search}%` : null;
    const activeFlag = !query.archived;

    const conditions: Prisma.Sql[] = [Prisma.sql`stock > 0`];
    if (query.categoryId) {
      conditions.push(Prisma.sql`category_id = ${query.categoryId}`);
    }
    if (query.isSerialized !== undefined) {
      conditions.push(Prisma.sql`is_serialized = ${query.isSerialized}`);
    }
    if (query.condition) {
      // At least one IN_STOCK unit matches — a mixed-condition product still
      // shows up if any of its units are the requested condition, never
      // silently hidden just because its units aren't all identical.
      conditions.push(Prisma.sql`unit_matches_condition`);
    }
    if (query.stockStatus === 'LOW_STOCK') {
      conditions.push(Prisma.sql`stock <= reorder_level`);
    } else if (query.stockStatus === 'IN_STOCK') {
      conditions.push(Prisma.sql`stock > reorder_level`);
    }
    if (searchPattern) {
      conditions.push(
        Prisma.sql`(name ILIKE ${searchPattern} OR sku ILIKE ${searchPattern} OR category_name ILIKE ${searchPattern} OR model_name ILIKE ${searchPattern} OR unit_matches_search)`,
      );
    }

    const SORT_COLUMN: Record<string, Prisma.Sql> = {
      createdAt: Prisma.sql`created_at`,
      name: Prisma.sql`name`,
      stock: Prisma.sql`stock`,
      price: Prisma.sql`sale_price`,
    };
    const orderDir =
      query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const orderBy = Prisma.sql`${SORT_COLUMN[query.sortBy] ?? SORT_COLUMN.createdAt} ${orderDir}, id ${orderDir}`;

    const baseQuery = Prisma.sql`
      WITH unit_stats AS (
        SELECT
          u."productId" AS product_id,
          COUNT(*) FILTER (WHERE u.status = 'IN_STOCK')::int AS available_units,
          (ARRAY_AGG(u."deviceCondition" ORDER BY u."createdAt" ASC) FILTER (WHERE u.status = 'IN_STOCK'))[1] AS sample_condition,
          (ARRAY_AGG(u.color ORDER BY u."createdAt" ASC) FILTER (WHERE u.status = 'IN_STOCK'))[1] AS sample_color,
          COUNT(DISTINCT u."deviceCondition") FILTER (WHERE u.status = 'IN_STOCK')::int AS distinct_conditions,
          COUNT(DISTINCT u.color) FILTER (WHERE u.status = 'IN_STOCK')::int AS distinct_colors,
          BOOL_OR(u."ptaStatus" = 'PTA' AND u.status = 'IN_STOCK') AS has_pta,
          BOOL_OR(u."ptaStatus" IN ('NON_PTA', 'JV') AND u.status = 'IN_STOCK') AS has_non_pta,
          BOOL_OR(
            ${searchPattern}::text IS NOT NULL
            AND (u.imei1 ILIKE ${searchPattern} OR u."serialNumber" ILIKE ${searchPattern})
          ) AS matches_search,
          BOOL_OR(
            ${query.condition ?? null}::text IS NOT NULL
            AND u."deviceCondition"::text = ${query.condition ?? null}
            AND u.status = 'IN_STOCK'
          ) AS matches_condition
        FROM "ProductUnit" u
        WHERE u."businessId" = ${businessId}
        GROUP BY u."productId"
      ),
      base AS (
        SELECT
          p.id AS id,
          p.name AS name,
          p.sku AS sku,
          p."salePrice" AS sale_price,
          p."reorderLevel" AS reorder_level,
          p."isSerialized" AS is_serialized,
          p."createdAt" AS created_at,
          c.id AS category_id,
          c.name AS category_name,
          m.id AS model_id,
          m.name AS model_name,
          CASE WHEN p."isSerialized" THEN COALESCE(us.available_units, 0) ELSE p."stockQty" END AS stock,
          CASE WHEN p."isSerialized" AND COALESCE(us.distinct_conditions, 0) = 1 THEN us.sample_condition ELSE NULL END AS condition,
          CASE WHEN p."isSerialized" AND COALESCE(us.distinct_colors, 0) = 1 THEN us.sample_color ELSE NULL END AS color,
          COALESCE(us.distinct_conditions, 0) > 1 AS mixed_conditions,
          COALESCE(us.distinct_colors, 0) > 1 AS mixed_colors,
          COALESCE(us.has_pta, false) AND COALESCE(us.has_non_pta, false) AS mixed_pta,
          COALESCE(us.matches_search, false) AS unit_matches_search,
          COALESCE(us.matches_condition, false) AS unit_matches_condition
        FROM "Product" p
        LEFT JOIN "Category" c ON c.id = p."categoryId"
        LEFT JOIN "Model" m ON m.id = p."modelId"
        LEFT JOIN unit_stats us ON us.product_id = p.id
        WHERE p."businessId" = ${businessId} AND p."isActive" = ${activeFlag}
      )
      SELECT * FROM base WHERE ${Prisma.join(conditions, ' AND ')}
    `;

    const countRows = await this.prisma.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS total FROM (${baseQuery}) AS combined`,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    type CatalogRow = {
      id: string;
      name: string;
      sku: string;
      sale_price: Prisma.Decimal | null;
      reorder_level: number;
      is_serialized: boolean;
      created_at: Date;
      category_id: string | null;
      category_name: string | null;
      model_id: string | null;
      model_name: string | null;
      stock: number;
      condition: string | null;
      color: string | null;
      mixed_conditions: boolean;
      mixed_colors: boolean;
      mixed_pta: boolean;
    };

    const rows =
      total === 0
        ? []
        : await this.prisma.$queryRaw<CatalogRow[]>(
            Prisma.sql`SELECT * FROM (${baseQuery}) AS filtered ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
          );

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      salePrice: r.sale_price != null ? r.sale_price.toString() : null,
      isSerialized: r.is_serialized,
      createdAt: r.created_at,
      category: r.category_id
        ? { id: r.category_id, name: r.category_name }
        : null,
      model: r.model_id ? { id: r.model_id, name: r.model_name } : null,
      stock: r.stock,
      condition: r.condition,
      color: r.color,
      mixedConditions: r.mixed_conditions,
      mixedColors: r.mixed_colors,
      mixedPta: r.mixed_pta,
      status:
        r.stock <= r.reorder_level
          ? ('LOW_STOCK' as const)
          : ('IN_STOCK' as const),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  // Category tabs ke counts — hamesha poore (active) dataset se, kabhi
  // paginated/displayed rows se nahi. Categories fully dynamic hain (Category
  // Terminal se aati hain), isliye ye fixed keys ke bajaye ek list return karta hai.
  // Counts must reflect exactly what the card grid shows — same availability
  // rule as findAll()'s inStockOnly path, via the shared helpers above.
  // Never a plain "how many active Product rows exist" count again.
  async getCounts(businessId: string) {
    this.assertTenant(businessId);
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        categoryId: true,
        isSerialized: true,
        stockQty: true,
        reorderLevel: true,
      },
    });

    const availabilityMap = await computeAvailabilityMap(
      this.prisma,
      businessId,
      products,
    );
    const inStock = products.filter((p) =>
      isInStock(p, availabilityMap.get(p.id)),
    );

    // Page-header stats — same availability rule, so these numbers always
    // match what the table underneath actually shows.
    let totalAvailableUnits = 0;
    let lowStockCount = 0;
    for (const p of inStock) {
      const stock = p.isSerialized
        ? (availabilityMap.get(p.id) ?? 0)
        : p.stockQty;
      totalAvailableUnits += stock;
      if (stock <= p.reorderLevel) lowStockCount += 1;
    }

    const categories = await this.prisma.category.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });
    const nameMap = new Map(categories.map((c) => [c.id, c.name]));

    const byCategoryCount = new Map<string, number>();
    for (const p of inStock) {
      const key = p.categoryId ?? '__uncategorized__';
      byCategoryCount.set(key, (byCategoryCount.get(key) ?? 0) + 1);
    }

    const byCategory = Array.from(byCategoryCount.entries()).map(
      ([key, count]) => ({
        id: key === '__uncategorized__' ? null : key,
        name:
          key === '__uncategorized__'
            ? 'Uncategorized'
            : (nameMap.get(key) ?? 'Unknown'),
        count,
      }),
    );

    return {
      all: inStock.length,
      categories: byCategory,
      totalAvailableUnits,
      lowStockCount,
    };
  }

  // Category tenant ki ho, mojood ho, active ho, aur sahi (serialized/accessory)
  // type ki ho — warna clear error, kabhi raw Prisma FK error nahi.
  private async resolveCategory(
    businessId: string,
    categoryId: string,
    expectedIsSerialized: boolean,
  ) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, businessId, isActive: true },
    });
    if (!category) {
      throw new BadRequestException(
        'Selected category was not found or is not active.',
      );
    }
    if (category.isSerialized !== expectedIsSerialized) {
      throw new BadRequestException(
        expectedIsSerialized
          ? 'This category is not configured for serialized (IMEI) products.'
          : 'This category is configured for serialized (IMEI) products — use the phone creation flow.',
      );
    }
    return category;
  }

  // Model tenant ki ho, mojood ho, aur SAME category ke andar ho — warna clear
  // error, kabhi raw Prisma FK error nahi.
  private async resolveModel(
    businessId: string,
    modelId: string,
    categoryId: string | null,
  ) {
    if (!categoryId) {
      throw new BadRequestException(
        'Select a category before choosing a model.',
      );
    }
    const model = await this.prisma.model.findFirst({
      where: { id: modelId, businessId, categoryId },
    });
    if (!model) {
      throw new BadRequestException(
        'Selected model was not found under the selected category.',
      );
    }
    return model;
  }

  // Add Product (phone) flow — model + first IMEI unit ek hi transaction mein
  async createPhone(businessId: string, dto: CreatePhoneDto) {
    this.assertTenant(businessId);

    await this.resolveCategory(businessId, dto.categoryId, true);
    const model = await this.resolveModel(
      businessId,
      dto.modelId,
      dto.categoryId,
    );

    const existingSku = await this.prisma.product.findFirst({
      where: { businessId, sku: dto.sku },
    });
    if (existingSku) {
      throw new ConflictException('This SKU already exists.');
    }

    // Quantity 1 (default, when omitted) is the existing single-device flow,
    // completely unchanged. Quantity > 1 requires one extra real, unique IMEI
    // per extra unit — manual multi-unit intake, never fabricated identities.
    const quantity = dto.quantity ?? 1;
    const extraImeis = dto.additionalImeis ?? [];
    if (quantity > 1 && extraImeis.length !== quantity - 1) {
      throw new BadRequestException(
        `Enter ${quantity - 1} additional IMEI number(s) to match the quantity entered.`,
      );
    }

    const allImeis = quantity > 1 ? [dto.imei1, ...extraImeis] : [dto.imei1];
    if (new Set(allImeis).size !== allImeis.length) {
      throw new BadRequestException(
        'Duplicate IMEI entered — each unit must have its own unique IMEI.',
      );
    }

    const existingImei = await this.prisma.productUnit.findFirst({
      where: { businessId, imei1: { in: allImeis } },
    });
    if (existingImei) {
      throw new ConflictException(
        'A device with this IMEI number already exists.',
      );
    }

    if (dto.serialNumber) {
      const existingSerial = await this.prisma.productUnit.findFirst({
        where: { businessId, serialNumber: dto.serialNumber },
      });
      if (existingSerial) {
        throw new ConflictException(
          'This Serial Number already exists in inventory.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          name: model.name,
          sku: dto.sku,
          costPrice: dto.costPrice,
          salePrice: dto.salePrice,
          stockQty: 0,
          reorderLevel: 0,
          categoryId: dto.categoryId,
          isSerialized: true,
          modelId: model.id,
          storage: dto.storage,
        },
      });

      const units = [];
      for (const [index, imei] of allImeis.entries()) {
        // Only the FIRST unit carries the single-add form's imei2/serialNumber
        // — those are single-device nuances, not something a shared batch of
        // otherwise-identical units all provide values for. Every unit's
        // color/condition/PTA/battery/price can be individually overridden
        // via unitOverrides (aligned by index) — two physical phones under
        // the same Product/Model are rarely identical, so nothing here is
        // forced to match the others.
        const isPrimary = index === 0;
        const override = dto.unitOverrides?.[index];
        const unit = await tx.productUnit.create({
          data: {
            businessId,
            productId: product.id,
            imei1: imei,
            imei2: isPrimary ? (dto.imei2 ?? null) : null,
            serialNumber: isPrimary ? (dto.serialNumber ?? null) : null,
            ram: override?.ram ?? dto.ram ?? null,
            storage: override?.storage ?? dto.storage ?? null,
            color: override?.color ?? dto.color,
            conditionGrade:
              override?.conditionGrade ?? dto.conditionGrade ?? null,
            batteryHealth: override?.batteryHealth ?? dto.batteryHealth ?? null,
            ptaStatus: override?.ptaStatus ?? dto.ptaStatus,
            deviceCondition: override?.deviceCondition ?? dto.deviceCondition,
            isNew:
              (override?.deviceCondition ?? dto.deviceCondition) ===
              'BRAND_NEW',
            boxIncluded: dto.boxIncluded ?? false,
            chargerIncluded: dto.chargerIncluded ?? false,
            warrantyDays: dto.warrantyDays ?? 0,
            supplier: dto.supplier ?? null,
            costPrice: override?.costPrice ?? dto.costPrice,
            salePrice: override?.salePrice ?? dto.salePrice,
            notes: override?.notes ?? dto.notes ?? null,
            status: UnitStatus.IN_STOCK,
          },
        });
        units.push(unit);
      }

      return { ...product, unit: units[0], units };
    });
  }

  // Sirf accessories (non-serialized) — serialized phones sirf createPhone() se
  // bante hain, taake bina ProductUnit ke koi "phantom" serialized product na bane.
  async create(businessId: string, dto: CreateProductDto) {
    this.assertTenant(businessId);

    await this.resolveCategory(businessId, dto.categoryId, false);

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
        isSerialized: false,
        color: dto.color,
        compatibility: dto.compatibility,
      },
    });
  }

  // Ek Product + (agar serialized hai) uski saari units — Products Page table
  // ke View/Edit actions ke liye, taake wahan poora catalogue load na karna pare.
  async findOne(businessId: string, id: string, role?: string) {
    this.assertTenant(businessId);
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: { category: true, model: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const hideCost = role !== 'ADMIN';

    if (!product.isSerialized) {
      return hideCost ? { ...product, costPrice: null } : product;
    }

    const units = await this.prisma.productUnit.findMany({
      where: { productId: id, businessId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...product,
      costPrice: hideCost ? null : product.costPrice,
      units: hideCost ? units.map((u) => ({ ...u, costPrice: null })) : units,
    };
  }

  // costPrice aur isSerialized qasdan yahan nahi — creation ke baad fix rehne
  // chahiye. categoryId editable hai (authorized user category badal sakta hai).
  async update(businessId: string, id: string, dto: UpdateProductDto) {
    this.assertTenant(businessId);
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    if (dto.categoryId !== undefined) {
      await this.resolveCategory(
        businessId,
        dto.categoryId,
        product.isSerialized,
      );
    }

    let modelId: string | undefined;
    let nameFromModel: string | undefined;
    if (dto.modelId !== undefined) {
      const model = await this.resolveModel(
        businessId,
        dto.modelId,
        dto.categoryId ?? product.categoryId,
      );
      modelId = model.id;
      nameFromModel = model.name;
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: nameFromModel ?? dto.name,
        barcode: dto.barcode,
        salePrice: dto.salePrice,
        stockQty: dto.stockQty,
        modelId,
        reorderLevel: dto.reorderLevel,
        categoryId: dto.categoryId,
        storage: dto.storage,
        color: dto.color,
        compatibility: dto.compatibility,
      },
    });
  }

  // Sales/inventory history wale product hard-delete nahi hote — archive
  // (isActive: false) ho jaate hain, taake purane invoices/reports theek rahein.
  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const [saleItemCount, historicalUnitCount] = await Promise.all([
      this.prisma.saleItem.count({ where: { productId: id } }),
      this.prisma.productUnit.count({
        where: { productId: id, status: { not: UnitStatus.IN_STOCK } },
      }),
    ]);

    if (saleItemCount > 0 || historicalUnitCount > 0) {
      await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        archived: true,
        message: 'Product has transaction history and was archived instead.',
      };
    }

    await this.prisma.product.delete({ where: { id } });
    return { archived: false, message: 'Product deleted successfully.' };
  }
}
