import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Ye service database se connect karti hai.
// Jab bhi database ka kaam ho, hum isi ko use karenge.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Jab app chalu hoti hai → database se connect
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Jab app band hoti hai → database se disconnect
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
