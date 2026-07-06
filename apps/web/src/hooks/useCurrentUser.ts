'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, CurrentUser } from '@/lib/auth';

// Custom hook: user data fetch karta hai aur loading/error state deta hai.
// Koi bhi page ise use kar sakta hai: const { user, loading } = useCurrentUser();
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Component load hote hi user data lao
    getCurrentUser()
      .then((data) => {
        setUser(data);
      })
      .catch(() => {
        setError('Could not load user data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { user, loading, error };
}