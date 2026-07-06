import { z } from 'zod';

// Ye schema batata hai .env mein har variable kaisa HONA chahiye.
// App boot hote waqt zod isse check karega. Galat/missing = app ruk jayegi (fail fast).
export const envSchema = z.object({
  // Database connection string — khali nahi ho sakti
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT secrets — security ke liye kam se kam 16 characters (chhoti secret asaani se tooti hai)
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),

  // Token expiry — string format jaise "15m", "7d". Default diya taake na ho to bhi chale.
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Port — .env se string aati hai, use number mein badalte hain
  PORT: z.coerce.number().default(4000),

  // App kis mode mein chal raha hai
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

// Ye TypeScript type schema se KHUD ban jati hai — hume alag se likhni nahi padti.
// Isse poore app mein type-safety milti hai (no any).
export type EnvVars = z.infer<typeof envSchema>;
