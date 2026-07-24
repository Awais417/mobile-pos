import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductUnitDto } from './create-product-unit.dto';

// Cost Price yahan se qasdan nadaarad hai — creation ke baad fix rehni chahiye.
export class UpdateProductUnitDto extends PartialType(
  OmitType(CreateProductUnitDto, ['costPrice'] as const),
) {}
