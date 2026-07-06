// Frontend ki central config — env values yahan se type-safe milti hain.
export const config = {
  // Backend API ka base URL. .env.local se aata hai.
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
} as const;