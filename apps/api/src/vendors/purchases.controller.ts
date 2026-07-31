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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { CreateVendorPaymentDto } from './dto/vendor-payment.dto';

const VIEW_ROLES = ['ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER'] as const;
const MANAGE_ROLES = ['ADMIN', 'BRANCH_MANAGER'] as const;

@ApiTags('purchases')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.purchasesService.findAll(businessId, user, {
      vendorId,
      status,
      outletId,
    });
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.purchasesService.findOne(businessId, user, id);
  }

  // Records a manual purchase (no product/inventory link) and, optionally,
  // its initial/advance payment — never creates stock of any kind.
  @Post()
  @Roles(...MANAGE_ROLES)
  create(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.purchasesService.create(businessId, user, dto);
  }

  @Post(':id/cancel')
  @Roles(...MANAGE_ROLES)
  cancel(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelPurchaseDto,
  ) {
    return this.purchasesService.cancel(businessId, user, id, dto);
  }

  // "Record Vendor Payment" / "Add Payment" — a later payment against this
  // specific bill. Accountant can also record payments (see spec).
  @Post(':id/payments')
  @Roles('ADMIN', 'ACCOUNTANT')
  addPayment(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateVendorPaymentDto,
  ) {
    return this.purchasesService.addPayment(businessId, user, id, dto);
  }
}
