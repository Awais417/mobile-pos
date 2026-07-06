import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterBusinessDto {
  @ApiProperty({ example: 'Ali Cash And Carry' })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiProperty({ example: 'PKR', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'Ali Khan' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: 'ali@shop.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
