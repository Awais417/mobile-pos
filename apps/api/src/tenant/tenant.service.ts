import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';

@Injectable()
export class TenantService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Business ki apni details — businessId se scope.
  async findById(businessId: string) {
    this.assertTenant(businessId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        currency: true,
        createdAt: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return business;
  }
}
