import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateProductUnitDto } from './dto/create-product-unit.dto';
import { UpdateProductUnitDto } from './dto/update-product-unit.dto';

type UnitWithProduct = Prisma.ProductUnitGetPayload<{
  include: { product: { include: { category: true; model: true } } };
}>;

@Injectable()
export class ProductUnitsService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(businessId: string, dto: CreateProductUnitDto) {
    this.assertTenant(businessId);

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    if (!product.isSerialized) {
      throw new BadRequestException(
        'This product is not serialized (IMEI-based). Enable isSerialized first.',
      );
    }

    const existing = await this.prisma.productUnit.findFirst({
      where: { businessId, imei1: dto.imei1 },
    });
    if (existing) {
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
          'A unit with this Serial Number already exists.',
        );
      }
    }

    return this.prisma.productUnit.create({
      data: {
        businessId,
        productId: dto.productId,
        imei1: dto.imei1 ?? null,
        imei2: dto.imei2 ?? null,
        serialNumber: dto.serialNumber ?? null,
        ram: dto.ram ?? null,
        color: dto.color ?? null,
        conditionGrade: dto.conditionGrade ?? null,
        batteryHealth: dto.batteryHealth ?? null,
        ptaStatus: dto.ptaStatus ?? null,
        deviceCondition: dto.deviceCondition,
        isNew: dto.isNew ?? dto.deviceCondition === 'BRAND_NEW',
        faceIdWorking: dto.faceIdWorking ?? null,
        screenOriginal: dto.screenOriginal ?? null,
        boxIncluded: dto.boxIncluded ?? false,
        chargerIncluded: dto.chargerIncluded ?? false,
        warrantyDays: dto.warrantyDays ?? 0,
        supplier: dto.supplier ?? null,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        notes: dto.notes ?? null,
      },
    });
  }

  async findAll(
    businessId: string,
    filters: { productId?: string; status?: string },
    role?: string,
  ) {
    this.assertTenant(businessId);

    // Non-admin (Salesman) sirf ek specific product ke units dekh sakta hai —
    // taake POS ka IMEI/unit picker chalta rahe, lekin poori Inventory list
    // (jo Inventory page dikhati hai) direct API se kabhi na mil sake.
    if (role !== 'ADMIN' && !filters.productId) {
      throw new ForbiddenException(
        'Select a specific product to view its units.',
      );
    }

    const units = await this.prisma.productUnit.findMany({
      where: {
        businessId,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.status ? { status: filters.status as UnitStatus } : {}),
      },
      include: { product: { include: { category: true, model: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (role !== 'ADMIN') {
      return units.map((u) => this.hideCostPrice(u));
    }
    return units;
  }

  // IMEI se dhoondho — POS scan/search ke liye
  async searchByImei(businessId: string, imei: string, role?: string) {
    this.assertTenant(businessId);
    const unit = await this.prisma.productUnit.findFirst({
      where: {
        businessId,
        OR: [{ imei1: imei }, { imei2: imei }],
      },
      include: { product: { include: { category: true, model: true } } },
    });

    if (unit && role !== 'ADMIN') {
      return this.hideCostPrice(unit);
    }
    return unit;
  }

  // Non-admin (cashier) roles ko cost price nazar nahi aani chahiye —
  // nested product.costPrice bhi chupana hai, warna waha se leak ho jayega
  private hideCostPrice(unit: UnitWithProduct): Omit<
    UnitWithProduct,
    'costPrice' | 'product'
  > & {
    costPrice: null;
    product: Omit<UnitWithProduct['product'], 'costPrice'> & {
      costPrice: null;
    };
  } {
    return {
      ...unit,
      costPrice: null,
      product: { ...unit.product, costPrice: null },
    };
  }

  async update(businessId: string, id: string, dto: UpdateProductUnitDto) {
    this.assertTenant(businessId);

    const unit = await this.prisma.productUnit.findFirst({
      where: { id, businessId },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    return this.prisma.productUnit.update({
      where: { id },
      data: {
        ...(dto.imei1 !== undefined ? { imei1: dto.imei1 } : {}),
        ...(dto.imei2 !== undefined ? { imei2: dto.imei2 } : {}),
        ...(dto.serialNumber !== undefined
          ? { serialNumber: dto.serialNumber }
          : {}),
        ...(dto.ram !== undefined ? { ram: dto.ram } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.conditionGrade !== undefined
          ? { conditionGrade: dto.conditionGrade }
          : {}),
        ...(dto.batteryHealth !== undefined
          ? { batteryHealth: dto.batteryHealth }
          : {}),
        ...(dto.ptaStatus !== undefined ? { ptaStatus: dto.ptaStatus } : {}),
        ...(dto.deviceCondition !== undefined
          ? { deviceCondition: dto.deviceCondition }
          : {}),
        ...(dto.supplier !== undefined ? { supplier: dto.supplier } : {}),
        ...(dto.isNew !== undefined ? { isNew: dto.isNew } : {}),
        ...(dto.faceIdWorking !== undefined
          ? { faceIdWorking: dto.faceIdWorking }
          : {}),
        ...(dto.screenOriginal !== undefined
          ? { screenOriginal: dto.screenOriginal }
          : {}),
        ...(dto.boxIncluded !== undefined
          ? { boxIncluded: dto.boxIncluded }
          : {}),
        ...(dto.chargerIncluded !== undefined
          ? { chargerIncluded: dto.chargerIncluded }
          : {}),
        ...(dto.warrantyDays !== undefined
          ? { warrantyDays: dto.warrantyDays }
          : {}),
        // costPrice qasdan yahan nahi — creation ke baad fix rehni chahiye
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);

    const unit = await this.prisma.productUnit.findFirst({
      where: { id, businessId },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    await this.prisma.productUnit.delete({ where: { id } });
    return { success: true };
  }
}
