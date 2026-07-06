import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';

// Tenant (Business) ka module — TenantService ko bundle karta hai.
@Module({
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
