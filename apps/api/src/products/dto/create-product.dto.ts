import { IsString, IsOptional, IsNumber, IsInt, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Coca Cola 1.5L' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'SKU-001' })
  @IsString()
  @MinLength(1)
  sku!: string;

  @ApiProperty({ example: '8964000123456', required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0)
  costPrice!: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  salePrice!: number;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;
}