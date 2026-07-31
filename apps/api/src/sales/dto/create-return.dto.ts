import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
  IsInt,
  IsNumber,
  IsIn,
  Min,
  IsOptional,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class ReturnLineDto {
  @ApiProperty({ example: 'sale-item-id-here' })
  @IsString()
  saleItemId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

// Required only when this return leaves a refund due to the customer
// (server-computed, never trusted from the client) — the "Refund Now" /
// "Refund Later" choice from the Return Settlement UI. `amount` must equal
// the server-computed refund due exactly.
export class RefundSettlementDto {
  @ApiProperty({ enum: ['REFUND_NOW', 'REFUND_LATER'] })
  @IsIn(['REFUND_NOW', 'REFUND_LATER'])
  mode!: 'REFUND_NOW' | 'REFUND_LATER';

  @ApiProperty({ example: 30000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, required: false })
  @ValidateIf((o) => o.mode === 'REFUND_NOW')
  @IsIn(['CASH', 'CARD', 'ONLINE_WALLET', 'BANK_TRANSFER'])
  method?: PaymentMethod;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.mode === 'REFUND_NOW' && o.method === 'ONLINE_WALLET')
  @IsString()
  provider?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o) => o.mode === 'REFUND_NOW' && o.method === 'BANK_TRANSFER')
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

// Returns one or more line items from a sale back to inventory. Always
// linked to the original Sale — never a standalone record.
export class CreateReturnDto {
  @ApiProperty({ type: [ReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];

  @ApiProperty({ required: false, example: 'Customer changed their mind' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiProperty({ required: false, type: RefundSettlementDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RefundSettlementDto)
  refundSettlement?: RefundSettlementDto;
}
