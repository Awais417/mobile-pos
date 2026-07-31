import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HideClientHistoryDto {
  @ApiProperty({ example: 'Duplicate entry entered by mistake' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
