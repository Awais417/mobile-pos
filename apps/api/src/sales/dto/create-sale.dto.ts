import {
  IsArray,
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsEnum,
  IsPositive,
  Min,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class SaleItemDto {
  @ApiProperty({ example: 'product-id-here' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;

  // Sirf phone (IMEI-based) product bechte waqt bhejein
  @ApiProperty({ required: false, example: 'productunit-id-here' })
  @IsOptional()
  @IsString()
  productUnitId?: string;

  // Negotiated/final price — agar dukaandar deal ke waqt price change kare
  @ApiProperty({ required: false, example: 45000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;
}

export class CreateSaleDto {
  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @ApiProperty({ enum: PaymentMethod, example: 'CASH' })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  // CASH — amount received (change calculate karne ke liye)
  @ApiProperty({ required: false, example: 1000 })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CASH)
  @IsNumber()
  @Min(0)
  cashReceived?: number;

  // ONLINE_WALLET — provider ka naam (optional)
  @ApiProperty({ required: false, example: 'JazzCash' })
  @IsOptional()
  @IsString()
  provider?: string;

  // BANK_TRANSFER — bank ka naam (optional)
  @ApiProperty({ required: false, example: 'HBL' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
