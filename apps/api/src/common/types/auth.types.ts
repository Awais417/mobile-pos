// Role ab ek text hai: "ADMIN" ya "SALESMAN" (matches Prisma's Role enum)
export type Role = 'ADMIN' | 'SALESMAN';

export interface JwtPayload {
  sub: string;
  businessId: string;
  role: Role;
  outletId: string | null;
}

export interface AuthenticatedUser {
  userId: string;
  businessId: string;
  role: Role;
  outletId: string | null;
}
