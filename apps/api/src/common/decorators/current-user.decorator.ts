import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/auth.types';

// Isse controller mein hum likh sakte hain: @CurrentUser() user: AuthenticatedUser
// Ye logged-in user ka data seedha nikaal kar de deta hai.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUser;
  },
);
