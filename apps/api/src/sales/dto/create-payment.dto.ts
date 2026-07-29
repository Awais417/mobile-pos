import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

// "Receive Payment" — records one additional amount received against an
// existing client sale. Never edits the sale's own totals.
export class CreatePaymentDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: 'CASH' })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ required: false, example: 'JazzCash' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ required: false, example: 'HBL' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false, example: 'Paid remaining balance in person' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  // When this payment was actually received — lets a later payment be
  // backdated (e.g. cash received yesterday). Omit to use "now".
  @ApiProperty({ required: false, example: '2026-07-27' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
