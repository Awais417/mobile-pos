import {
  IsArray,
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  ArrayMinSize,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

// A manual, free-text purchase line — never a reference into the existing
// Product catalogue. Line Total is always derived server-side as
// quantity * unitCost, never trusted from the client.
export class PurchaseItemInputDto {
  @ApiProperty({ example: 'Samsung Galaxy A14 (used)' })
  @IsString()
  itemName!: string;

  @ApiProperty({ required: false, example: '128GB, blue, PTA approved' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 45000 })
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

// The initial/advance payment recorded in the same transaction as the
// purchase itself — optional; omit to record the purchase as fully unpaid.
export class InitialPaymentInputDto {
  @ApiProperty({ example: 100000 })
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

export class CreatePurchaseDto {
  @ApiProperty({ example: 'vendor-id-here' })
  @IsString()
  vendorId!: string;

  // Omit for a business with no outlet/branch management set up yet — same
  // nullable convention as User.outletId.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  outletId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiProperty({ type: [PurchaseItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items!: PurchaseItemInputDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  // Initial/advance payment made to the vendor at purchase time — its
  // amount must not exceed the computed purchase total (validated
  // server-side in PurchasesService, never trusting a client-sent total).
  @ApiProperty({ required: false, type: InitialPaymentInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPaymentInputDto)
  initialPayment?: InitialPaymentInputDto;
}
