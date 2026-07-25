'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login, getCurrentUser } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api-client';
import { AlertTriangleIcon, Loader2Icon, StoreIcon } from '@/components/icons';
import { FormField } from '@/components/ui/FormField';
import { inputClass, primaryButtonClass } from '@/components/ui/styles';

export default function LoginPage() {
  const router = useRouter();

  // Form ka data yaad rakhne ke liye (state)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Jab form submit ho (login button dabe)
  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault(); // page reload rokta hai (default form behaviour)
    setError(null);
    setLoading(true);

    try {
      // Login karo (tokens mil jayenge)
      await login({ email, password });

      // Ab current user ki details lao (role pata karne ke liye)
      const user = await getCurrentUser();

      // Role ke hisaab se redirect
      if (user.role === 'SALESMAN') {
        router.push('/terminal');
      } else {
        // ADMIN dashboard jaata hai
        router.push('/dashboard');
      }
    } catch (err) {
      // Backend se aaya error dikhao
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false); // loading band karo (chahe success ho ya error)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
            <StoreIcon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your Mobile Shop POS account</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                className={inputClass}
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={inputClass}
              />
            </FormField>

            <button type="submit" disabled={loading} className={`w-full ${primaryButtonClass}`}>
              {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
