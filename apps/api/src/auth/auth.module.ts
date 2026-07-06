import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

// Auth ki saari cheezein ek jagah jodta hai.
@Module({
  imports: [
    // Passport — login/token system ka base
    PassportModule,
    // JwtModule — token banane/kholne ke liye
    JwtModule.register({}),
  ],
  controllers: [AuthController], // URLs
  providers: [AuthService, JwtStrategy], // logic + token kholne wala
})
export class AuthModule {}
