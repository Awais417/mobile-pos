import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';

// ===== Types =====
export type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUser {
  userId: string;
  businessId: string;
  role: Role;
  outletId: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Register form ka data
export interface RegisterCredentials {
  businessName: string;
  fullName: string;
  email: string;
  password: string;
}

// ===== Auth functions =====

// Login
export async function login(
  credentials: LoginCredentials,
): Promise<CurrentUser> {
  const tokens = await apiClient.post<AuthTokens>('/auth/login', credentials);
  tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);

  const user = await apiClient.get<CurrentUser>('/auth/me', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  return user;
}

// Register: naya business + admin banao, token save, user data lao
export async function registerBusiness(
  credentials: RegisterCredentials,
): Promise<CurrentUser> {
  const tokens = await apiClient.post<AuthTokens>(
    '/auth/register-business',
    credentials,
  );
  tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);

  const user = await apiClient.get<CurrentUser>('/auth/me', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  return user;
}

// Current user lao
export async function getCurrentUser(): Promise<CurrentUser> {
  const token = tokenStorage.getAccessToken();
  if (!token) {
    throw new Error('No access token found.');
  }

  return apiClient.get<CurrentUser>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Logout
export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();

  if (refreshToken) {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // Backend fail bhi ho to local token hatao
    }
  }

  tokenStorage.clearTokens();
}