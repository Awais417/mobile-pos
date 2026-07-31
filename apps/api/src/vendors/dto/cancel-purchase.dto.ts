import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelPurchaseDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
