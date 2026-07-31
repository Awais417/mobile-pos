import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';

// ACCOUNTANT/BRANCH_MANAGER added for the Vendor module — ADMIN/SALESMAN
// behavior is unchanged.
export type Role = 'ADMIN' | 'SALESMAN' | 'ACCOUNTANT' | 'BRANCH_MANAGER';

export interface CurrentUser {
  userId: string;
  businessId: string;
  email: string;
  fullName: string;
  role: Role;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>('/auth/login', input);
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function registerBusiness(input: {
  businessName: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>(
    '/auth/register-business',
    input,
  );
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiClient.get<CurrentUser>('/auth/me');
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  try {
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken });
    }
  } catch {
    // logout fail ho to bhi local tokens clear kar dein
  } finally {
    tokenStorage.clearTokens();
  }
}