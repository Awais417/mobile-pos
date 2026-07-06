import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantModule } from './tenant/tenant.module';
import { ProductsModule } from './products/products.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule,

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Infrastructure
    PrismaModule,
    CommonModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantModule,
    ProductsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
