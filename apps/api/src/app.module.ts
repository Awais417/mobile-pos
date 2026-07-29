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
import { ProductUnitsModule } from './product-units/product-units.module';
import { CategoriesModule } from './categories/categories.module';
import { ModelsModule } from './models/models.module';
import { SalesModule } from './sales/sales.module';
import { StaffModule } from './staff/staff.module';
import { HealthModule } from './health/health.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ClientsModule } from './clients/clients.module';

@Module({
  imports: [
    AppConfigModule,

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),

    PrismaModule,
    CommonModule,

    AuthModule,
    UsersModule,
    TenantModule,
    ProductsModule,
    ProductUnitsModule,
    CategoriesModule,
    ModelsModule,
    SalesModule,
    StaffModule,
    HealthModule,
    ExpensesModule,
    ClientsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
