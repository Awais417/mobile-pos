import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VendorStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;
}
