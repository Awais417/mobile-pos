import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { ProductUnitsService } from './product-units.service';
import { CreateProductUnitDto } from './dto/create-product-unit.dto';
import { UpdateProductUnitDto } from './dto/update-product-unit.dto';

@ApiTags('product-units')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-units')
export class ProductUnitsController {
  constructor(private readonly service: ProductUnitsService) {}

  @Post()
  @Roles('ADMIN')
  create(@TenantId() businessId: string, @Body() dto: CreateProductUnitDto) {
    return this.service.create(businessId, dto);
  }

  @Get()
  findAll(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(businessId, { productId, status }, user.role);
  }

  @Get('search')
  search(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('imei') imei: string,
  ) {
    return this.service.searchByImei(businessId, imei, user.role);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductUnitDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
