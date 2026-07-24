'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboardIcon,
  ShoppingCartIcon,
  PackageIcon,
  TagIcon,
  BoxesIcon,
  ReceiptIcon,
  UsersIcon,
  LogOutIcon,
  StoreIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons';
import type { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
  adminOnly: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped by real modules only — no Customers/Suppliers/Reports/Settings/
// Returns/Users, since none of those exist in this application yet.
// Salesman ke liye sirf POS Terminal — baaki sab adminOnly. Ye sirf UI hai;
// asal enforcement RoleGate (route-level) aur backend @Roles() guards karte hain.
const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, adminOnly: true }],
  },
  {
    label: 'Sales',
    items: [
      { href: '/terminal', label: 'POS Terminal', icon: ShoppingCartIcon, adminOnly: false },
      { href: '/sales', label: 'Sales History', icon: ReceiptIcon, adminOnly: true },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: PackageIcon, adminOnly: true },
      { href: '/categories', label: 'Categories', icon: TagIcon, adminOnly: true },
      { href: '/inventory', label: 'Inventory', icon: BoxesIcon, adminOnly: true },
    ],
  },
  {
    label: 'System',
    items: [{ href: '/staff', label: 'Staff', icon: UsersIcon, adminOnly: true }],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  SALESMAN: 'Salesman',
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === '1') setCollapsed(true);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || user?.role === 'ADMIN') }))
    .filter((g) => g.items.length > 0);

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
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col bg-sidebar transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-full lg:translate-x-0 lg:transition-[width] ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'}`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <StoreIcon className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-bold text-white">Mobile POS</div>
                <div className="truncate text-[11px] text-sidebar-muted">Mobile Shop</div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-sidebar-muted hover:bg-white/10 hover:text-white lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links — scrolls independently if it ever overflows */}
        <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-sidebar-hover text-white'
                          : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white'
                      } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-primary' : 'text-sidebar-muted group-hover:text-white'}`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleCollapsed}
          className="mx-3 mb-2 hidden items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-medium text-sidebar-muted transition hover:bg-white/5 hover:text-white lg:flex"
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          {!collapsed && 'Collapse'}
        </button>

        {/* Bottom section — pinned via mt-auto on the flex-col aside, never pushed off-screen */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className={`mb-1 flex items-center gap-3 rounded-xl px-2 py-2 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {user ? user.role.charAt(0) : '·'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {user ? user.fullName : 'Loading...'}
                </div>
                <div className="truncate text-[11px] text-sidebar-muted">
                  {user ? ROLE_LABELS[user.role] ?? user.role : 'Signed in'}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <LogOutIcon className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>
    </>
  );
}
