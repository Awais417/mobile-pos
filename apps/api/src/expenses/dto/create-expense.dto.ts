import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDto {
  // Whole rupees only — matches every other money field entered by hand
  // in this app (no fractional rupees anywhere in the shop's workflow).
  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'Shop Rent' })
  @IsString()
  @MinLength(1)
  title!: string;

  // The date the expense actually happened — drives every Daily/Weekly/
  // Monthly summary, independent of when it was entered into the system.
  @ApiProperty({ example: '2026-07-27' })
  @IsISO8601()
  date!: string;

  @ApiProperty({ required: false, example: 'Paid via bank transfer' })
  @IsOptional()
  @IsString()
  note?: string;
}
