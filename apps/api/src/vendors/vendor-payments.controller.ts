import {
  Controller,
  Post,
  Get,
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
import { VendorPaymentsService } from './vendor-payments.service';
import { ReverseVendorPaymentDto } from './dto/vendor-payment.dto';

const MANAGE_ROLES = ['ADMIN', 'ACCOUNTANT'] as const;

@ApiTags('vendor-payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendor-payments')
export class VendorPaymentsController {
  constructor(private readonly vendorPaymentsService: VendorPaymentsService) {}

  @Get()
  @Roles(...MANAGE_ROLES)
  findAll(
    @TenantId() businessId: string,
    @Query('vendorId') vendorId?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.vendorPaymentsService.findAll(businessId, {
      vendorId,
      includeDeleted: includeDeleted === 'true',
    });
  }

  // "Delete Payment" action — soft delete/void, not a hard delete (see
  // VendorPaymentsService.reverse). Only ADMIN/ACCOUNTANT reach this route;
  // BRANCH_MANAGER/SALESMAN are rejected by the class-level @Roles guard.
  @Post(':id/reverse')
  @Roles(...MANAGE_ROLES)
  reverse(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReverseVendorPaymentDto,
  ) {
    return this.vendorPaymentsService.reverse(businessId, user, id, dto);
  }
}
