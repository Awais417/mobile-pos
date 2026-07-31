import {
  Controller,
  Get,
  Post,
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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';

@ApiTags('staff')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles('ADMIN')
  findAll(
    @TenantId() businessId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.staffService.findAll(businessId, includeInactive === 'true');
  }

  @Post()
  @Roles('ADMIN')
  create(@TenantId() businessId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.create(businessId, dto);
  }

  // Deletes a staff member, or safely deactivates them instead if they have
  // sales/payment/purchase history — never your own account.
  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.staffService.remove(businessId, id, user.userId);
  }
}
