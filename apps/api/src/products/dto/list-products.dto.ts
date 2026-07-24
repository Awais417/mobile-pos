import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceCondition } from '@prisma/client';

const ALLOWED_LIMITS = [25, 50, 100] as const;

export const STOCK_STATUS_OPTIONS = ['IN_STOCK', 'LOW_STOCK'] as const;
export type StockStatusOption = (typeof STOCK_STATUS_OPTIONS)[number];

export const SORT_BY_OPTIONS = [
  'createdAt',
  'name',
  'stock',
  'price',
] as const;
export type SortByOption = (typeof SORT_BY_OPTIONS)[number];

export const SORT_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type SortOrderOption = (typeof SORT_ORDER_OPTIONS)[number];

// Product-level catalog listing — one row per Product (Stock is an aggregate:
// available IN_STOCK unit count for serialized, stockQty for accessories).
// Zero-stock / inactive products are never returned here; the Products Page
// only ever shows what's actually sellable right now.
export class ListProductsDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ required: false, default: 25, enum: ALLOWED_LIMITS })
  @IsOptional()
  @Type(() => Number)
  @IsIn(ALLOWED_LIMITS)
  limit: number = 25;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false, enum: DeviceCondition })
  @IsOptional()
  @IsIn(Object.values(DeviceCondition))
  condition?: DeviceCondition;

  @ApiProperty({ required: false, enum: STOCK_STATUS_OPTIONS })
  @IsOptional()
  @IsIn(STOCK_STATUS_OPTIONS)
  stockStatus?: StockStatusOption;

  // true = serialized (IMEI) only, false = accessories only, omitted = both
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  isSerialized?: boolean;

  @ApiProperty({ required: false, enum: SORT_BY_OPTIONS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORT_BY_OPTIONS)
  sortBy: SortByOption = 'createdAt';

  @ApiProperty({ required: false, enum: SORT_ORDER_OPTIONS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDER_OPTIONS)
  sortOrder: SortOrderOption = 'desc';

  // Admin-only "Active/Archived" toggle.
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  archived: boolean = false;
}
