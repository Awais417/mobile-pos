import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ReactNode } from 'react';

// (pos) group ke saare pages protected.
export default function PosLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}