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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@ApiTags('categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@TenantId() businessId: string) {
    return this.categoriesService.findAll(businessId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@TenantId() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(businessId, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.categoriesService.remove(businessId, id);
  }
}