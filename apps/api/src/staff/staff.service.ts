import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedService } from '../common/tenant/tenant-scoped.service';
import { CreateStaffDto } from './dto/create-staff.dto';

const staffSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  outletId: true,
  outlet: { select: { name: true } },
} as const;

function toStaffRow<T extends { outlet: { name: string } | null }>(user: T) {
  const { outlet, ...rest } = user;
  return { ...rest, outletName: outlet?.name ?? null };
}

@Injectable()
export class StaffService extends TenantScopedService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // Deactivated staff are hidden from the default (active) list, same
  // convention as Client/Vendor archiving — pass includeInactive to reveal
  // them again (e.g. to review who was deactivated and why).
  async findAll(businessId: string, includeInactive?: boolean) {
    this.assertTenant(businessId);
    const users = await this.prisma.user.findMany({
      where: { businessId, ...(includeInactive ? {} : { isActive: true }) },
      select: staffSelect,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toStaffRow);
  }

  async create(businessId: string, dto: CreateStaffDto) {
    this.assertTenant(businessId);

    const existing = await this.prisma.user.findFirst({
      where: { businessId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        'This email is already used in your business.',
      );
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
      select: staffSelect,
    });

    return toStaffRow(user);
  }

  // Removes a staff member. Never allowed against your own account. If they
  // ever processed a sale, received a payment, or recorded a purchase/vendor
  // payment, that history must never be deleted — they're deactivated
  // instead (isActive: false blocks login; see AuthService.login), same
  // safe pattern as Client/Vendor archiving. Only a staff member with no
  // such history at all is actually removed from the database.
  async remove(businessId: string, id: string, currentUserId: string) {
    this.assertTenant(businessId);
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const staffMember = await this.prisma.user.findFirst({
      where: { id, businessId },
    });
    if (!staffMember) {
      throw new NotFoundException('Staff member not found.');
    }

    const [saleCount, paymentCount, purchaseCount, vendorPaymentCount] =
      await Promise.all([
        this.prisma.sale.count({ where: { businessId, cashierId: id } }),
        this.prisma.payment.count({ where: { businessId, receivedBy: id } }),
        this.prisma.purchase.count({ where: { businessId, createdBy: id } }),
        this.prisma.vendorPayment.count({
          where: { businessId, createdBy: id },
        }),
      ]);
    const hasHistory =
      saleCount > 0 ||
      paymentCount > 0 ||
      purchaseCount > 0 ||
      vendorPaymentCount > 0;

    if (hasHistory) {
      const deactivated = await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: staffSelect,
      });
      return { ...toStaffRow(deactivated), deactivated: true };
    }

    await this.prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  }
}
