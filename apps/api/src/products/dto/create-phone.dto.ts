import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PtaStatus, DeviceCondition } from '@prisma/client';

// Per-unit attribute overrides for batch intake — every physical phone can
// have its own Color/Condition/PTA Status/Battery Health/price even though
// they share one Product/Model row. Any field left out falls back to the
// shared top-level value on CreatePhoneDto (unit 1's own defaults).
export class UnitOverrideDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ram?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storage?: string;

  @ApiProperty({ required: false, enum: DeviceCondition })
  @IsOptional()
  @IsEnum(DeviceCondition)
  deviceCondition?: DeviceCondition;

  @ApiProperty({ required: false, enum: PtaStatus })
  @IsOptional()
  @IsEnum(PtaStatus)
  ptaStatus?: PtaStatus;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryHealth?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  conditionGrade?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;
}

// Add Product (phone) flow — Category -> Model -> specs -> inventory -> pricing.
// Product.name is derived server-side from the selected Model, never typed here.
export class CreatePhoneDto {
  // Category admin ne Category Terminal mein banayi hoti hai (isSerialized: true).
  // Backend confirm karta hai ke ye category isSerialized hai, tenant ki hai, aur active hai.
  @ApiProperty({ example: 'category-id-here' })
  @IsString()
  @IsNotEmpty({ message: 'Category is required.' })
  categoryId!: string;

  @ApiProperty({ example: 'model-id-here' })
  @IsString()
  @IsNotEmpty({ message: 'Model is required.' })
  modelId!: string;

  @ApiProperty({ example: 'IP14PM-256-PUR-001' })
  @IsString()
  @IsNotEmpty({ message: 'SKU is required.' })
  sku!: string;

  // -- Specifications shared by the whole Product (Model + Storage define
  // the grouped card) --
  @ApiProperty({ required: false, example: '8GB' })
  @IsOptional()
  @IsString()
  ram?: string;

  @ApiProperty({ required: false, example: '256GB' })
  @IsOptional()
  @IsString()
  storage?: string;

  // -- Defaults for unit 1 (and every unit that doesn't override them via
  // unitOverrides) — these can legitimately differ per physical phone, so
  // they live on ProductUnit, never on Product. --
  @ApiProperty({ required: false, example: 'Purple' })
  @IsOptional()
  @IsString()
  color?: string;

  // Optional — the Add Product form no longer collects a device condition
  // per unit; when omitted, Prisma's column default (BRAND_NEW) applies.
  @ApiProperty({ required: false, enum: DeviceCondition })
  @IsOptional()
  @IsEnum(DeviceCondition)
  deviceCondition?: DeviceCondition;

  @ApiProperty({ required: false, enum: PtaStatus })
  @IsOptional()
  @IsEnum(PtaStatus)
  ptaStatus?: PtaStatus;

  // -- Device identity (unit level) — IMEI is mandatory for every serialized
  // (phone) product, regardless of brand. Serial Number is a separate,
  // always-optional supplementary identifier — it never substitutes for IMEI.
  @ApiProperty({ example: '359876543210987' })
  @IsNotEmpty({ message: 'IMEI is required.' })
  @Matches(/^\d{15}$/, { message: 'IMEI must contain 15 digits.' })
  imei1!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imei2?: string;

  @ApiProperty({ required: false, example: 'SN-00294831' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  // -- Initial stock quantity (manual multi-unit intake) — quantity 1 (the
  // default, when omitted) behaves exactly as a single-device add always has:
  // one Product, one ProductUnit, imei1 only. quantity > 1 additionally
  // requires one extra IMEI per extra unit — every unit is still its own
  // real, individually identifiable device; nothing is ever fabricated.
  @ApiProperty({ required: false, minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @Matches(/^\d{15}$/, {
    each: true,
    message: 'Each additional IMEI must contain 15 digits.',
  })
  additionalImeis?: string[];

  // Aligned by index to [imei1, ...additionalImeis] — unitOverrides[0] is
  // unit 1, unitOverrides[1] is additionalImeis[0], and so on. Any index
  // (or any field within an index) that's missing falls back to the shared
  // color/deviceCondition/ptaStatus/batteryHealth/conditionGrade/costPrice/
  // salePrice above.
  @ApiProperty({ required: false, type: [UnitOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnitOverrideDto)
  unitOverrides?: UnitOverrideDto[];

  @ApiProperty({ required: false, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  conditionGrade?: number;

  // Battery Health — genuinely optional for every device type. Empty means
  // "not recorded", stored as null; never forced to a fake 0/100 value.
  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryHealth?: number;

  // -- Pricing (defaults for unit 1 / every unit without its own override) --
  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPrice!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  salePrice!: number;

  // -- Optional details --
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  boxIncluded?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  chargerIncluded?: boolean;
}
