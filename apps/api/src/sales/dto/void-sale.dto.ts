import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidSaleDto {
  @ApiProperty({ required: false, example: 'Sale created by mistake' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
