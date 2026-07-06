'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/token-storage';

interface ProtectedRouteProps {
  children: ReactNode;
}

// Ye component "darban" hai — check karta hai user logged in hai ya nahi.
// Token hai to page dikhata hai, warna login pe bhej deta hai.
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();

  // Jab tak check ho raha hai, page nahi dikhate (flicker rokta hai)
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Component load hote hi token check karo
    const token = tokenStorage.getAccessToken();

    if (!token) {
      // Token nahi = login pe bhej do
      router.replace('/login');
    } else {
      // Token hai = page dikhne do
      setIsChecking(false);
    }
  }, [router]);

  // Check ke dauran ek loading screen
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Token confirm ho gaya = asli page dikhao
  return <>{children}</>;
}