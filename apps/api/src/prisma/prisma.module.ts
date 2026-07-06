import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() ka matlab: ek baar import karo, phir har jagah kaam karega.
// Isse humein har module mein alag se PrismaModule import nahi karna padta.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
