import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateModelDto {
  @ApiProperty({ example: 'category-id-here' })
  @IsString()
  @IsNotEmpty({ message: 'Category is required.' })
  categoryId!: string;

  @ApiProperty({ example: 'Galaxy S24 Ultra' })
  @IsString()
  @MinLength(1)
  name!: string;
}
