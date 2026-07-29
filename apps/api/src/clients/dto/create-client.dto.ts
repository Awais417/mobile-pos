import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'Ahmed Khan' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '03001234567' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ required: false, example: 'Model Town, Lahore' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiProperty({ required: false, example: 'Prefers WhatsApp contact' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
