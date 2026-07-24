import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CsvImportService } from './csv/csv-import.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, CsvImportService],
})
export class ProductsModule {}
