import { apiClient } from './api-client';
import { Role } from './auth';

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  outletId: string | null;
  outletName: string | null;
}

export interface CreateStaffInput {
  fullName: string;
  email: string;
  password: string;
  role: 'SALESMAN' | 'ACCOUNTANT' | 'BRANCH_MANAGER';
}

export async function getStaff(includeInactive?: boolean): Promise<Staff[]> {
  return apiClient.get<Staff[]>(`/staff${includeInactive ? '?includeInactive=true' : ''}`);
}

export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  return apiClient.post<Staff>('/staff', input);
}

// Deletes this staff member, or safely deactivates them instead (backend
// decides) if they have sales/payment/purchase history — their historical
// records are never removed either way.
export async function deleteStaff(id: string): Promise<void> {
  await apiClient.del(`/staff/${id}`);
}