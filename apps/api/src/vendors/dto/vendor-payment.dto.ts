import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

// Records a later payment against one specific purchase — Vendor and
// Purchase are both implied by the route (POST /purchases/:id/payments),
// so this DTO only carries the amount/method/details. Reuses the existing
// payment methods (Cash/Card/Bank Transfer/Online Wallet).
export class CreateVendorPaymentDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: 'CASH' })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.method === PaymentMethod.ONLINE_WALLET)
  @IsString()
  provider?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.method === PaymentMethod.BANK_TRANSFER)
  @IsString()
  bankName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paidAt?: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Deduct this payment from the Available Sales Cash shown on the dashboard. This will not change Total Sales or Profit.',
  })
  @IsOptional()
  deductFromDashboardCash?: boolean;
}

export class ReverseVendorPaymentDto {
  @ApiProperty({ example: 'Recorded against the wrong vendor' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
