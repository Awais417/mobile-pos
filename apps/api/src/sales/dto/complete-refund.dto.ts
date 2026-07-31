import {
  IsString,
  IsOptional,
  MaxLength,
  ValidateIf,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

// Settles a pending "Refund Later" — pays out the amount that was already
// recorded as owed to the customer, creating the negative refund Payment.
export class CompleteRefundDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsIn(['CASH', 'CARD', 'ONLINE_WALLET', 'BANK_TRANSFER'])
  method!: PaymentMethod;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.method === 'ONLINE_WALLET')
  @IsString()
  provider?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.method === 'BANK_TRANSFER')
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
