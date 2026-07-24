import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, AuthenticatedUser } from '../common/types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  // ---------- 1. REGISTER ----------
  async registerBusiness(dto: RegisterBusinessDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('This email is already registered.');
    }

    const passwordHash = await argon2.hash(dto.password);

    const business = await this.prisma.business.create({
      data: {
        name: dto.businessName,
        currency: dto.currency ?? 'PKR',
        users: {
          create: {
            email: dto.email,
            fullName: dto.fullName,
            passwordHash,
            role: 'ADMIN',
          },
        },
      },
      include: { users: true },
    });

    const admin = business.users[0];

    return this.issueTokens({
      sub: admin.id,
      businessId: business.id,
      role: 'ADMIN',
      outletId: admin.outletId,
    });
  }

  // ---------- 2. LOGIN ----------
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account is disabled.');
    }

    return this.issueTokens({
      sub: user.id,
      businessId: user.businessId,
      role: user.role as JwtPayload['role'],
      outletId: user.outletId,
    });
  }

  // ---------- 3. REFRESH (rotation: purana revoke, naya do) ----------
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    // Agar token DB mein hai hi nahi, ya expire ho chuka
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    // THEFT DETECTION: agar token pehle se revoked hai, matlab koi use kar
    // chuka (ya chori hua). Security ke liye is user ke SAARE tokens band kar do.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token reuse detected. Please log in again.',
      );
    }

    // Purana token revoke karo (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Naye tokens do
    return this.issueTokens({
      sub: payload.sub,
      businessId: payload.businessId,
      role: payload.role,
      outletId: payload.outletId,
    });
  }

  // ---------- ME (profile header/menu ke liye fullName/email chahiye —
  // JWT payload mein qasdan nahi hote, isliye ek chhoti si DB lookup) ----------
  async getMe(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    });
    return {
      ...user,
      fullName: dbUser?.fullName ?? '',
      email: dbUser?.email ?? '',
    };
  }

  // ---------- 4. LOGOUT (naya) ----------
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const tokenHash = this.hashToken(refreshToken);

    // Token dhoondho aur revoke kar do. updateMany use kiya taake agar
    // token na mile to error na aaye (idempotent — logout hamesha safe).
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // ---------- HELPER: tokens banana ----------
  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiresIn,
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: this.config.jwtRefreshExpiresIn,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
