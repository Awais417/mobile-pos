import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  // GET /api/health — app aur database ki sehat batata hai
  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database check: ek chhoti query chala kar dekhta hai DB zinda hai
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch {
          return { database: { status: 'down' } };
        }
      },
    ]);
  }
}
