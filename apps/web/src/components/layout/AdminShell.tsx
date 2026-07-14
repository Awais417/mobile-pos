'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/layout/Header';

export function AdminShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column scrolls independently from the sidebar */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="scrollbar-thin flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
