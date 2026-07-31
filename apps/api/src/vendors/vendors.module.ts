import { Module } from '@nestjs/common';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { VendorPaymentsController } from './vendor-payments.controller';
import { VendorPaymentsService } from './vendor-payments.service';
import { PayablesController } from './payables.controller';
import { PayablesService } from './payables.service';

@Module({
  controllers: [
    VendorsController,
    PurchasesController,
    VendorPaymentsController,
    PayablesController,
  ],
  providers: [
    VendorsService,
    PurchasesService,
    VendorPaymentsService,
    PayablesService,
  ],
})
export class VendorsModule {}
