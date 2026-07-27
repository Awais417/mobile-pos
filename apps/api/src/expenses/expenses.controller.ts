import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

// Same access level as the rest of Finance/Dashboard (getSummary,
// getDashboard) — ADMIN only.
@ApiTags('expenses')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
@Roles('ADMIN')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@TenantId() businessId: string) {
    return this.expensesService.findAll(businessId);
  }

  // Today/Weekly/Monthly/Overall Sales vs Expenses vs Net Sales.
  @Get('summary')
  getSummary(@TenantId() businessId: string) {
    return this.expensesService.getSummary(businessId);
  }

  @Post()
  create(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(businessId, user.userId, dto);
  }

  @Patch(':id')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(businessId, id, dto);
  }

  @Delete(':id')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.expensesService.remove(businessId, id);
  }
}
