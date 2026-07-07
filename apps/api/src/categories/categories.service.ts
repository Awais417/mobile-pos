import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(businessId: string) {
    this.assertTenant(businessId);
    return this.prisma.category.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async create(businessId: string, dto: CreateCategoryDto) {
    this.assertTenant(businessId);

    const existing = await this.prisma.category.findFirst({
      where: { businessId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('This category already exists.');
    }

    return this.prisma.category.create({
      data: { businessId, name: dto.name },
    });
  }

  async remove(businessId: string, id: string) {
    this.assertTenant(businessId);
    const category = await this.prisma.category.findFirst({
      where: { id, businessId },
    });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }
}