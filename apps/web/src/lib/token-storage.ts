// Token ko localStorage mein manage karta hai.
// NOTE (technical debt): localStorage XSS ke against kamzor hai.
// Production se pehle httpOnly cookies pe shift karna hoga.

const ACCESS_TOKEN_KEY = 'pos_access_token';
const REFRESH_TOKEN_KEY = 'pos_refresh_token';

export const tokenStorage = {
  // Dono token save karo (login ke baad)
  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return; // server pe localStorage nahi hota
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  // Access token padho (API calls ke liye)
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  // Refresh token padho
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  // Dono token hatao (logout ke baad)
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};