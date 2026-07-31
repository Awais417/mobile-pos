import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVendorDto {
  @ApiProperty({ example: 'Al-Karam Mobile Traders' })
  @IsString()
  @MinLength(1)
  businessName!: string;

  @ApiProperty({ example: '03001234567' })
  @IsString()
  @MinLength(1)
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
