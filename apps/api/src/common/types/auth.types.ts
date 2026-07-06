// Role ab ek text hai: "ADMIN", "MANAGER", ya "CASHIER"
export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

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
