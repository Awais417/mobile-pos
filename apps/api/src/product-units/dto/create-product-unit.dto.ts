import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PtaStatus, DeviceCondition } from '@prisma/client';

// Mandatory: productId, IMEI, deviceCondition, costPrice. Serial Number is a
// separate, always-optional supplementary identifier — it never substitutes
// for IMEI. Selling Price is optional here too — it can instead be entered
// at the point of sale in POS. Everything else (RAM, storage, color, battery
// health, PTA status, ...) is genuinely optional — never forced.
export class CreateProductUnitDto {
  @ApiProperty()
  @IsString()
  productId!: string;

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

  @ApiProperty({ required: false, example: '8GB' })
  @IsOptional()
  @IsString()
  ram?: string;

  @ApiProperty({ required: false, example: 'Black' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ enum: DeviceCondition })
  @IsEnum(DeviceCondition)
  deviceCondition!: DeviceCondition;

  @ApiProperty({ required: false, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  conditionGrade?: number;

  // Battery Health — genuinely optional for every device type; empty means
  // "not recorded" (stored as null), never a forced 0/100/"Unknown".
  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryHealth?: number;

  @ApiProperty({ required: false, enum: PtaStatus })
  @IsOptional()
  @IsEnum(PtaStatus)
  ptaStatus?: PtaStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  faceIdWorking?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  screenOriginal?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  boxIncluded?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  chargerIncluded?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyDays?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPrice!: number;

  // Optional — Cost Price alone is enough; the final Selling Price can
  // instead be entered at the point of sale in POS.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
