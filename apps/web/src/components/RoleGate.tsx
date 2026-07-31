'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Loader2Icon } from '@/components/icons';

// Routes inside the (admin) layout group that a SALESMAN is allowed to open.
// Everything else in that group is ADMIN-only — enforced here once, centrally,
// rather than scattered per-page checks. The real security boundary is still
// the backend (@Roles on every controller) — this only controls what the
// Salesman's browser navigates to.
const SALESMAN_ALLOWED_PATHS = ['/terminal', '/clients'];

// Vendor module roles (additive) — mirrors the backend @Roles() split:
// Accountant manages vendors/purchases (read) + payments/ledger/payables;
// Branch Manager creates/receives purchases for their own branch only.
const ACCOUNTANT_ALLOWED_PATHS = ['/vendors', '/purchases', '/vendor-payments', '/payables'];
const BRANCH_MANAGER_ALLOWED_PATHS = ['/vendors', '/purchases'];

export function RoleGate({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  const isAllowed =
    !!user &&
    (user.role === 'ADMIN' ||
      (user.role === 'SALESMAN' && SALESMAN_ALLOWED_PATHS.includes(pathname)) ||
      (user.role === 'ACCOUNTANT' && ACCOUNTANT_ALLOWED_PATHS.includes(pathname)) ||
      (user.role === 'BRANCH_MANAGER' && BRANCH_MANAGER_ALLOWED_PATHS.includes(pathname)));

  useEffect(() => {
    if (!loading && user && !isAllowed) {
      router.replace('/terminal');
    }
  }, [loading, user, isAllowed, router]);

  if (loading || !isAllowed) {
    return (
      <div className="flex min-h-full items-center justify-center py-24">
        <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return <>{children}</>;
}
