import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';

export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

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

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
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
  // apiClient.get khud token attach karta hai aur 401 pe auto-refresh karta hai
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