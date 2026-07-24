import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { CsvImportService } from './csv/csv-import.service';

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — a bulk device intake file has no reason to exceed this

@ApiTags('products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly csvImportService: CsvImportService,
  ) {}

  @Get()
  findAll(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
    @Query('inStockOnly') inStockOnly?: string,
  ) {
    return this.productsService.findAll(businessId, user.role, {
      includeArchived: includeArchived === 'true',
      inStockOnly: inStockOnly === 'true',
    });
  }

  // Category tabs ke counts — All/iPhone/Android/Accessories
  // Category tab counts — Products management page hi use karta hai
  @Get('counts')
  @Roles('ADMIN')
  getCounts(@TenantId() businessId: string) {
    return this.productsService.getCounts(businessId);
  }

  // Admin Products Page — server-side paginated/searched/filtered/sorted catalogue.
  // Kept separate from the plain findAll() above, which POS Terminal still relies
  // on for its own full, unpaginated client-side product search.
  @Get('catalog')
  @Roles('ADMIN')
  findCatalogPage(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductsDto,
  ) {
    return this.productsService.findCatalogPage(businessId, user.role, query);
  }

  // Single product + its units (if serialized) — used by the Products Page
  // table's View/Edit actions so they don't need the full catalogue in memory.
  @Get(':id')
  @Roles('ADMIN')
  findOne(
    @TenantId() businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.productsService.findOne(businessId, id, user.role);
  }

  @Post()
  @Roles('ADMIN')
  create(@TenantId() businessId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(businessId, dto);
  }

  // Add Product (phone) — model + first IMEI unit ek hi request mein
  @Post('phones')
  @Roles('ADMIN')
  createPhone(@TenantId() businessId: string, @Body() dto: CreatePhoneDto) {
    return this.productsService.createPhone(businessId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @TenantId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(businessId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@TenantId() businessId: string, @Param('id') id: string) {
    return this.productsService.remove(businessId, id);
  }

  // Bulk CSV intake for serialized devices — see csv-import.service.ts for
  // the exact column contract and per-row error reporting.
  @Post('csv-import')
  @Roles('ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @TenantId() businessId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No CSV file was uploaded.');
    }
    if (file.size > MAX_CSV_SIZE_BYTES) {
      throw new BadRequestException('CSV file is too large (max 5MB).');
    }
    return this.csvImportService.importSerializedDevices(
      businessId,
      file.buffer,
    );
  }
}
