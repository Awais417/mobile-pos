import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@ApiTags('products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@TenantId() businessId: string) {
    return this.productsService.findAll(businessId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@TenantId() businessId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(businessId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.productsService.remove(businessId, id);
  }
}