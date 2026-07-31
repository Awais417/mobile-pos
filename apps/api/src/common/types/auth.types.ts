// Role ab ek text hai (matches Prisma's Role enum). ACCOUNTANT/BRANCH_MANAGER
// added for the Vendor module — ADMIN/SALESMAN behavior is unchanged.
export type Role = 'ADMIN' | 'SALESMAN' | 'ACCOUNTANT' | 'BRANCH_MANAGER';

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
