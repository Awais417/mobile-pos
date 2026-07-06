import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { JwtPayload, AuthenticatedUser } from '../../common/types/auth.types';

// Ye token ko kholti hai aur user ka data nikalti hai.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not defined in .env');
    }

    super({
      // Token "Authorization: Bearer <token>" header se nikalta hai
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Token sahi hone par ye chalta hai. Jo return karta hai woh request.user ban jata hai.
  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.businessId) {
      throw new UnauthorizedException('Invalid token payload.');
    }

    return {
      userId: payload.sub,
      businessId: payload.businessId,
      role: payload.role,
      outletId: payload.outletId,
    };
  }
}
