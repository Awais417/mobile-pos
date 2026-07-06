import { BadRequestException } from '@nestjs/common';

// Base class jo tenant-scoped services extend karti hain.
// Ye ek helper deta hai jo pakka karta hai businessId valid hai —
// warna query chalne se pehle hi error (fail fast, no data leak).
export abstract class TenantScopedService {
  // Har tenant-scoped query se pehle isse call karo.
  // Agar businessId khali/undefined hua to yahin ruk jao.
  protected assertTenant(businessId: string): string {
    if (!businessId || businessId.trim().length === 0) {
      throw new BadRequestException('Tenant context (businessId) is missing.');
    }
    return businessId;
  }
}
