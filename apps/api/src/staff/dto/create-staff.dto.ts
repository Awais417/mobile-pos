import { IsString, IsEmail, MinLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStaffDto {
  @ApiProperty({ example: 'Ali Salesman' })
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty({ example: 'ali@shop.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: 'SALESMAN',
    enum: ['SALESMAN', 'ACCOUNTANT', 'BRANCH_MANAGER'],
  })
  @IsIn(['SALESMAN', 'ACCOUNTANT', 'BRANCH_MANAGER'])
  role!: 'SALESMAN' | 'ACCOUNTANT' | 'BRANCH_MANAGER';
}
