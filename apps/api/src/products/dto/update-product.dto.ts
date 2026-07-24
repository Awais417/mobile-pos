import { IsString, IsOptional, IsNumber, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Cost Price yahan se qasdan nadaarad hai — creation ke baad fix rehni chahiye.
// isSerialized bhi nadaarad hai — ek accessory phantom "phone" mein na badal jaye
// (bina kisi ProductUnit ke) normal edit ke zariye.
export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

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

  // Phones ke liye — dusra Model select karne ke liye (accessories mein nahi bheja jaata)
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  modelId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  compatibility?: string;
}
