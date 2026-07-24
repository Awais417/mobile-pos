import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminShell } from '@/components/layout/AdminShell';
import { RoleGate } from '@/components/RoleGate';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminShell>
        <RoleGate>{children}</RoleGate>
      </AdminShell>
    </ProtectedRoute>
  );
}