import { Injectable, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(businessId: string) {
    this.assertTenant(businessId);
    return this.prisma.user.findMany({
      where: { businessId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(businessId: string, dto: CreateStaffDto) {
    this.assertTenant(businessId);

    const existing = await this.prisma.user.findFirst({
      where: { businessId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException('This email is already used in your business.');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        businessId,
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }
}