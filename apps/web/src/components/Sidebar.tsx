'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/terminal', label: 'Terminal', icon: '🛒' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/categories', label: 'Categories', icon: '🏷️' },
  { href: '/sales', label: 'Sales', icon: '🧾' },
  { href: '/staff', label: 'Staff', icon: '👥' },
];
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo/Title */}
      <div className="border-b border-gray-200 px-5 py-4">
        <span className="text-lg font-bold text-gray-900">POS + ERP</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}