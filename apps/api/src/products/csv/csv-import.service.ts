import { Injectable } from '@nestjs/common';
import { DeviceCondition, PtaStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantScopedService } from '../../common/tenant/tenant-scoped.service';
import { parseCsv, csvRowsToObjects } from './csv-parse.util';

export interface CsvRowResult {
  row: number;
  status: 'created' | 'error';
  message: string;
}

const CONDITION_ALIASES: Record<string, DeviceCondition> = {
  BRAND_NEW: 'BRAND_NEW',
  NEW: 'BRAND_NEW',
  OPEN_BOX: 'OPEN_BOX',
  USED: 'USED',
  REFURBISHED: 'REFURBISHED',
  CPO: 'CPO',
};

const PTA_ALIASES: Record<string, PtaStatus> = {
  PTA: 'PTA',
  NON_PTA: 'NON_PTA',
  NONPTA: 'NON_PTA',
  JV: 'JV',
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// CSV Bulk Intake — one row = one physical serialized unit (IMEI or Serial
// Number required). The `quantity` column is accepted for forward
// compatibility with the documented format but is not used to fabricate
// multiple units from one row: a physical device's identity (IMEI/serial)
// can't be duplicated safely, so quantity>1 rows still create exactly one
// unit and this is called out per-row in the report rather than guessed.
@Injectable()
export class CsvImportService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async importSerializedDevices(businessId: string, fileBuffer: Buffer) {
    this.assertTenant(businessId);

    const text = fileBuffer.toString('utf-8');
    const rows = csvRowsToObjects(parseCsv(text));
    const results: CsvRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const r = rows[i];

      try {
        await this.importRow(businessId, r);
        results.push({
          row: rowNum,
          status: 'created',
          message: 'Imported successfully.',
        });
      } catch (err) {
        results.push({
          row: rowNum,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
    }

    return {
      totalRows: rows.length,
      imported: results.filter((r) => r.status === 'created').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  private async importRow(businessId: string, r: Record<string, string>) {
    const categoryName = r.category?.trim();
    const modelName = r.model?.trim();
    // Spaces/dashes ignore karte hain (e.g. "1234 5678 9012 345") — sirf
    // digits count hote hain, formatting differences duplicate-check ko
    // kabhi affect nahi karni chahiye.
    const imei = r.imei ? r.imei.replace(/[^0-9]/g, '') : '';
    const serialNumber = r.serialNumber?.trim() || undefined;
    const costPrice = Number(r.costPrice);
    const sellingPrice = Number(r.defaultSellingPrice);

    if (!categoryName) throw new Error('Category is required.');
    if (!modelName) throw new Error('Model is required.');
    if (!imei) throw new Error('IMEI is required.');
    if (!/^\d{15}$/.test(imei)) {
      throw new Error('IMEI must contain 15 digits.');
    }
    if (!r.condition?.trim()) throw new Error('Condition is required.');
    const condition = CONDITION_ALIASES[normalizeKey(r.condition)];
    if (!condition) {
      throw new Error(`Unrecognized condition "${r.condition}".`);
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new Error('Cost Price must be a non-negative number.');
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      throw new Error('Default Selling Price must be a non-negative number.');
    }

    let ptaStatus: PtaStatus | undefined;
    if (r.ptaStatus?.trim()) {
      ptaStatus = PTA_ALIASES[normalizeKey(r.ptaStatus)];
      if (!ptaStatus)
        throw new Error(`Unrecognized PTA status "${r.ptaStatus}".`);
    }

    let batteryHealth: number | undefined;
    if (r.batteryHealth?.trim()) {
      const parsed = Number(r.batteryHealth);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error('Battery Health must be a number between 0 and 100.');
      }
      batteryHealth = parsed;
    }

    const existingImei = await this.prisma.productUnit.findFirst({
      where: { businessId, imei1: imei },
    });
    if (existingImei) {
      throw new Error('A device with this IMEI number already exists.');
    }
    if (serialNumber) {
      const existing = await this.prisma.productUnit.findFirst({
        where: { businessId, serialNumber },
      });
      if (existing)
        throw new Error(`Serial Number ${serialNumber} already exists.`);
    }

    let category = await this.prisma.category.findFirst({
      where: {
        businessId,
        name: { equals: categoryName, mode: 'insensitive' },
        isSerialized: true,
      },
    });
    if (!category) {
      category = await this.prisma.category.create({
        data: {
          businessId,
          name: categoryName,
          isSerialized: true,
          slug: slugify(categoryName),
        },
      });
    }

    let model = await this.prisma.model.findFirst({
      where: {
        categoryId: category.id,
        name: { equals: modelName, mode: 'insensitive' },
      },
    });
    if (!model) {
      model = await this.prisma.model.create({
        data: { businessId, categoryId: category.id, name: modelName },
      });
    }

    const storage = r.storage?.trim() || null;
    const color = r.color?.trim() || null;

    let product = await this.prisma.product.findFirst({
      where: { businessId, modelId: model.id, storage, color },
    });
    if (!product) {
      const sku = await this.generateSku(
        businessId,
        model.name,
        storage,
        color,
      );
      product = await this.prisma.product.create({
        data: {
          businessId,
          categoryId: category.id,
          modelId: model.id,
          name: model.name,
          sku,
          costPrice,
          salePrice: sellingPrice,
          stockQty: 0,
          reorderLevel: 0,
          isSerialized: true,
          storage,
          color,
        },
      });
    }

    await this.prisma.productUnit.create({
      data: {
        businessId,
        productId: product.id,
        imei1: imei ?? null,
        serialNumber: serialNumber ?? null,
        ram: r.ram?.trim() || null,
        color,
        batteryHealth: batteryHealth ?? null,
        ptaStatus: ptaStatus ?? null,
        deviceCondition: condition,
        isNew: condition === 'BRAND_NEW',
        costPrice,
        salePrice: sellingPrice,
        status: 'IN_STOCK',
      },
    });
  }

  private async generateSku(
    businessId: string,
    modelName: string,
    storage: string | null,
    color: string | null,
  ): Promise<string> {
    const base = [modelName, storage, color]
      .filter(Boolean)
      .join('-')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let candidate = base;
    let counter = 1;
    while (
      await this.prisma.product.findFirst({
        where: { businessId, sku: candidate },
      })
    ) {
      counter++;
      candidate = `${base}-${counter}`;
    }
    return candidate;
  }
}
