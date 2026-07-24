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
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

// Admin-only — the Add/Edit Product form (Category -> Model dropdown) and the
// Categories page's "view models under category" are both admin-only surfaces.
// POS never calls this directly; it reads model info already nested on
// GET /products.
@ApiTags('models')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  findAll(
    @TenantId() businessId: string,
    @Query('categoryId') categoryId?: string,
    @Query('active') active?: string,
  ) {
    return this.modelsService.findAll(businessId, {
      categoryId,
      activeOnly: active === 'true',
    });
  }

  @Post()
  create(@TenantId() businessId: string, @Body() dto: CreateModelDto) {
    return this.modelsService.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateModelDto,
  ) {
    return this.modelsService.update(businessId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.modelsService.remove(businessId, id);
  }
}
