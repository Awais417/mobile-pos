import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
  IsInt,
  Min,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReturnLineDto {
  @ApiProperty({ example: 'sale-item-id-here' })
  @IsString()
  saleItemId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
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
}
