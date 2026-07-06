import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';

// UsersService ab TenantScopedService extend karti hai —
// isse assertTenant() helper mil jata hai.
@Injectable()
export class UsersService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // User ko ID se dhoondho — SIRF is business ke andar (tenant isolation).
  async findById(userId: string, businessId: string) {
    // Pehle tenant confirm karo (khali hua to yahin error)
    this.assertTenant(businessId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        outletId: true,
        businessId: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }
}
