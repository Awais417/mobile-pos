'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/token-storage';
import { getCurrentUser } from '@/lib/auth';

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
        if (user.role === 'CASHIER') {
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
}