import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Common cheezein (guards) ko poori app mein available karta hai.
// @Global() → har module ise bina import kiye use kar sakta hai.
@Global()
@Module({
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class CommonModule {}
