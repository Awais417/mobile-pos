import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Logout ke liye refresh token chahiye (jise band karna hai).
export class LogoutDto {
  @ApiProperty({ example: 'paste-your-refresh-token-here' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
