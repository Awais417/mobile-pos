'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BellIcon, ChevronDownIcon, LogOutIcon, MenuIcon, UserIcon } from '@/components/icons';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/terminal': 'POS Terminal',
  '/products': 'Products',
  '/categories': 'Categories',
  '/inventory': 'Inventory',
  '/sales': 'Sales History',
  '/staff': 'Staff',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  SALESMAN: 'Salesman',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const title = PAGE_TITLES[pathname] ?? 'Admin';

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

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
        <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Notifications — no notifications backend exists yet, so this is an
            honest empty state, never a fabricated count/badge. */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-lg">
              <p className="text-sm font-medium text-slate-700">No notifications yet</p>
              <p className="mt-1 text-xs text-slate-400">You&apos;re all caught up.</p>
            </div>
          )}
        </div>

        {/* Profile menu */}
        {user && (
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5 transition hover:bg-slate-100"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-xs font-medium text-slate-700 sm:block">
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
              <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <UserIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{user.fullName}</div>
                    <div className="truncate text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
