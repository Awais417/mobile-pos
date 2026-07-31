import { apiClient } from './api-client';
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
  role: 'SALESMAN' | 'ACCOUNTANT' | 'BRANCH_MANAGER';
}

export async function getStaff(): Promise<Staff[]> {
  return apiClient.get<Staff[]>('/staff');
}

export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  return apiClient.post<Staff>('/staff', input);
}