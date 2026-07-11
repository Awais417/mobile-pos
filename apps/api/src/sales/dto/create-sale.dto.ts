import {
  IsArray,
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Matches,
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

  // ONLINE_WALLET — provider ka naam zaroori
  @ApiProperty({ required: false, example: 'JazzCash' })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.ONLINE_WALLET)
  @IsString()
  provider?: string;

  // BANK_TRANSFER — bank ka naam zaroori
  @ApiProperty({ required: false, example: 'HBL' })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.BANK_TRANSFER)
  @IsString()
  bankName?: string;

  // CARD — last 4 digits zaroori (poora card number kabhi nahi)
  @ApiProperty({ required: false, example: '4582' })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CARD)
  @Matches(/^\d{4}$/, {
    message: 'cardLastFour must be exactly 4 digits',
  })
  cardLastFour?: string;

  // CARD / ONLINE_WALLET / BANK_TRANSFER — reference number zaroori
  @ApiProperty({ required: false, example: 'TXN-12345' })
  @ValidateIf(
    (o) =>
      o.paymentMethod === PaymentMethod.CARD ||
      o.paymentMethod === PaymentMethod.ONLINE_WALLET ||
      o.paymentMethod === PaymentMethod.BANK_TRANSFER,
  )
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}