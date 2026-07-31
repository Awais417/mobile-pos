import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PayablesService } from './payables.service';

const VIEW_ROLES = ['ADMIN', 'ACCOUNTANT'] as const;

@ApiTags('payables')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payables')
export class PayablesController {
  constructor(private readonly payablesService: PayablesService) {}

  @Get('summary')
  @Roles(...VIEW_ROLES)
  getSummary(@TenantId() businessId: string) {
    return this.payablesService.getSummary(businessId);
  }

  @Get('vendors')
  @Roles(...VIEW_ROLES)
  getVendorWiseOutstanding(@TenantId() businessId: string) {
    return this.payablesService.getVendorWiseOutstanding(businessId);
  }

  @Get('bills')
  @Roles(...VIEW_ROLES)
  getOutstandingBills(
    @TenantId() businessId: string,
    @Query('overdueOnly') overdueOnly?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.payablesService.getOutstandingBills(businessId, {
      overdueOnly: overdueOnly === 'true',
      dueBefore,
      vendorId,
    });
  }
}
