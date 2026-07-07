import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';
import { Role } from './auth';

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffInput {
  fullName: string;
  email: string;
  password: string;
  role: 'MANAGER' | 'CASHIER';
}

function authHeader() {
  const token = tokenStorage.getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function getStaff(): Promise<Staff[]> {
  return apiClient.get<Staff[]>('/staff', { headers: authHeader() });
}

export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  return apiClient.post<Staff>('/staff', input, { headers: authHeader() });
}