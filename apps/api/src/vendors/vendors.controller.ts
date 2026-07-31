import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorStatusDto } from './dto/vendor-status.dto';

const VIEW_ROLES = ['ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER'] as const;

@ApiTags('vendors')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(
    @TenantId() businessId: string,
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.vendorsService.findAll(businessId, {
      search,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get('outlets')
  @Roles(...VIEW_ROLES)
  listOutlets(@TenantId() businessId: string) {
    return this.vendorsService.listOutlets(businessId);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@TenantId() businessId: string, @Param('id') id: string) {
    return this.vendorsService.findOne(businessId, id);
  }

  @Post()
  @Roles('ADMIN')
  create(@TenantId() businessId: string, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(businessId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(businessId, id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  setStatus(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VendorStatusDto,
  ) {
    return this.vendorsService.setStatus(businessId, id, user.userId, dto);
  }

  // Permanently deletes this vendor and every purchase/payment that belongs
  // to it — distinct from setStatus() above, which only deactivates.
  @Delete(':id')
  @Roles('ADMIN')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.vendorsService.remove(businessId, id);
  }
}
