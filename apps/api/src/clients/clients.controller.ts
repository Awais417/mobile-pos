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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { HideClientHistoryDto } from './dto/hide-client-history.dto';

// Admin can view all clients; Salesman can list/search/add/view them too —
// only editing an existing client's basic info is Admin-only (see the
// method-level override on update() below).
@ApiTags('clients')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
@Roles('ADMIN', 'SALESMAN')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(
    @TenantId() businessId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.clientsService.findAll(
      businessId,
      search,
      status,
      includeArchived === 'true',
    );
  }

  // Dashboard's Cash Collection section — Admin only, same as the rest of
  // Dashboard/Finance. Declared before ':id' so "receivables" is never
  // swallowed as a client id.
  @Get('receivables/summary')
  @Roles('ADMIN')
  getReceivablesSummary(@TenantId() businessId: string) {
    return this.clientsService.getReceivablesSummary(businessId);
  }

  @Get(':id')
  findOne(@TenantId() businessId: string, @Param('id') id: string) {
    return this.clientsService.findOne(businessId, id);
  }

  @Post()
  create(@TenantId() businessId: string, @Body() dto: CreateClientDto) {
    return this.clientsService.create(businessId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(businessId, id, dto);
  }

  // Soft delete — Admin only. Blocked (400) unless the client's outstanding
  // balance is exactly 0 across every linked sale. Never removes the row;
  // see ClientsService.archive for the full explanation.
  @Delete(':id')
  @Roles('ADMIN')
  archive(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.clientsService.archive(businessId, id, user.userId);
  }

  // Hides one Sale/Payment/Return row from this client's History tabs only
  // — the underlying record (and every total derived from it) is untouched.
  // Admin only, and a reason is always required.
  @Delete(':id/history/:entryType/:entryId')
  @Roles('ADMIN')
  hideHistoryEntry(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('entryType') entryType: string,
    @Param('entryId') entryId: string,
    @Body() dto: HideClientHistoryDto,
  ) {
    return this.clientsService.hideHistoryEntry(
      businessId,
      id,
      entryType.toUpperCase(),
      entryId,
      dto.reason,
      user.userId,
    );
  }

  // "Clear Client History" — hides every currently-visible Sale/Payment/
  // Return row for this client in one action. Same safe hide, just in bulk.
  @Delete(':id/history')
  @Roles('ADMIN')
  clearHistory(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HideClientHistoryDto,
  ) {
    return this.clientsService.clearHistory(businessId, id, dto.reason, user.userId);
  }
}
