import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Accessories (non-serialized) ke liye — serialized phones sirf
// /products/phones (CreatePhoneDto) se banti hain, yahan se nahi.
export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPrice!: number;

  // Optional — Cost Price alone is enough to create a product; the final
  // Selling Price can instead be entered per-unit at the point of sale in POS.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  // Category admin ne Category Terminal mein banayi hoti hai (isSerialized: false)
  @ApiProperty({ example: 'category-id-here' })
  @IsString()
  @IsNotEmpty({ message: 'Category is required.' })
  categoryId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  compatibility?: string;
}
