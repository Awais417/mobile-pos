import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ArchiveSaleDto {
  @ApiProperty({
    required: false,
    example: 'Duplicate entry, corrected in a later sale',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
