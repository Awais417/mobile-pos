import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminShell } from '@/components/layout/AdminShell';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  );
}