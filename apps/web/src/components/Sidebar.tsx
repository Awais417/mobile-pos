'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { logout } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboardIcon,
  ShoppingCartIcon,
  PackageIcon,
  TagIcon,
  ReceiptIcon,
  UsersIcon,
  LogOutIcon,
  StoreIcon,
  XIcon,
} from '@/components/icons';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';

const navItems: {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  adminOnly: boolean;
}[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, adminOnly: false },
  { href: '/terminal', label: 'Terminal', icon: ShoppingCartIcon, adminOnly: false },
  { href: '/products', label: 'Products', icon: PackageIcon, adminOnly: false },
  { href: '/categories', label: 'Categories', icon: TagIcon, adminOnly: false },
  { href: '/sales', label: 'Sales', icon: ReceiptIcon, adminOnly: false },
  { href: '/staff', label: 'Staff', icon: UsersIcon, adminOnly: true },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN',
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-full lg:w-64 lg:translate-x-0 lg:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <StoreIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">POS + ERP</div>
              <div className="text-[11px] text-slate-400">Cash &amp; Carry</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links — scrolls independently if it ever overflows */}
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${
                    active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section — pinned via mt-auto on the flex-col aside, never pushed off-screen */}
        <div className="mt-auto border-t border-slate-200 p-3">
          <div className="mb-1 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {user ? user.role.charAt(0) : '·'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">
                {user ? ROLE_LABELS[user.role] ?? user.role : 'Loading...'}
              </div>
              <div className="text-[11px] text-slate-400">Signed in</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOutIcon className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
