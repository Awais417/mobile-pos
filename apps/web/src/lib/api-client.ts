import { config } from './config';
import { tokenStorage } from './token-storage';

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Refresh token se naya access token lene ki koshish.
// Sirf ek baar chalti hai (multiple calls ek saath expire hon to).
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  // Agar refresh already chal raha hai, usi ka intezaar karo
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const url = `${config.apiUrl}${endpoint}`;

  // Agar token hai to Authorization header lagao (auto)
  const token = tokenStorage.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  // 401 = token expire. Ek baar refresh karke dobara try karo.
  if (response.status === 401 && !isRetry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Naye token ke saath wahi call dobara (retry)
      return request<T>(endpoint, options, true);
    }
    // Refresh fail = token clear, login pe jana padega
    tokenStorage.clearTokens();
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const apiError = data as ApiError | null;
    throw new ApiRequestError(
      response.status,
      apiError?.message ?? 'Something went wrong. Please try again.',
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  del: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};