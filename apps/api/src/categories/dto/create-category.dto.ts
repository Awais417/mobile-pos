import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Samsung' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  // true = is category ke products IMEI se serialize hote hain
  // (ProductUnit banti hai); false = simple accessory
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isSerialized?: boolean;
}
