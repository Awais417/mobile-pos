'use client';

import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { MenuIcon } from '@/components/icons';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/terminal': 'Terminal',
  '/products': 'Products',
  '/categories': 'Categories',
  '/sales': 'Sales History',
  '/staff': 'Staff',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const title = PAGE_TITLES[pathname] ?? 'Admin';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span>Admin</span>
            <span>/</span>
            <span className="text-slate-500">{title}</span>
          </div>
          <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
            {title}
          </h1>
        </div>
      </div>

      {user && (
        <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
            {user.role.charAt(0)}
          </div>
          <div className="hidden text-xs font-medium text-slate-700 sm:block">
            {ROLE_LABELS[user.role] ?? user.role}
          </div>
        </div>
      )}
    </header>
  );
}
