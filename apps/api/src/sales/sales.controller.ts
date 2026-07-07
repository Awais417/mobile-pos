import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@ApiTags('sales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.create(businessId, user.userId, dto);
  }

  @Get('summary')
  getSummary(@TenantId() businessId: string) {
    return this.salesService.getSummary(businessId);
  }

  @Get()
  findAll(@TenantId() businessId: string) {
    return this.salesService.findAll(businessId);
  }
}