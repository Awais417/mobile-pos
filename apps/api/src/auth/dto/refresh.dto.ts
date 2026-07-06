import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'paste-your-refresh-token-here' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
