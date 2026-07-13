import {
  Controller,
  Post,
  Get,
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
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@ApiTags('sales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get('dashboard')
  getDashboard(
    @TenantId() businessId: string,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    const safeDays = [1, 7, 30, 90, 365].includes(parsedDays) ? parsedDays : 7;
    return this.salesService.getDashboard(businessId, safeDays);
  }

  @Get()
  findAll(@TenantId() businessId: string) {
    return this.salesService.findAll(businessId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.salesService.remove(businessId, id);
  }
}