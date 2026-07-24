'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/token-storage';
import { getCurrentUser } from '@/lib/auth';
import { Loader2Icon } from '@/components/icons';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Home page load hote hi decide karo user ko kahan bhejein
    const token = tokenStorage.getAccessToken();

    // Token nahi = login pe bhejo
    if (!token) {
      router.replace('/login');
      return;
    }

    // Token hai = user ka role dekh kar sahi page pe bhejo
    getCurrentUser()
      .then((user) => {
        if (user.role === 'SALESMAN') {
          router.replace('/terminal');
        } else {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        // Token invalid/expire = login pe bhejo
        tokenStorage.clearTokens();
        router.replace('/login');
      });
  }, [router]);

  // Redirect hone tak ek loading screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}