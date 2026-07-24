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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@TenantId() businessId: string, @Query('active') active?: string) {
    return this.categoriesService.findAll(businessId, {
      activeOnly: active === 'true',
    });
  }

  @Post()
  @Roles('ADMIN')
  create(@TenantId() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(businessId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(businessId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.categoriesService.remove(businessId, id);
  }
}
