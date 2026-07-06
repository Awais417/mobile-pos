import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/auth.types';

// Shortcut: @TenantId() se seedha businessId milta hai.
// Ye tenant isolation ko har controller mein aasan aur consistent banata hai.
// businessId JWT se aata hai (JwtStrategy ne request.user mein daala tha) —
// isliye user ise fake nahi kar sakta (token signed hai).
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;
    return user.businessId;
  },
);
