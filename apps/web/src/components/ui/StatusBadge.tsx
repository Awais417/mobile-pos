import { ReactNode } from 'react';

// Single source of truth for status → color across the whole app.
// Available/Active/Paid = success, Sold/Info = info, Low Stock = warning,
// Out of Stock/Danger = danger, Reserved = purple, Archived/Disabled = neutral.
export type BadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'purple' | 'neutral';

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  info: 'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
  neutral: 'bg-slate-100 text-slate-600',
};

const dotClasses: Record<BadgeTone, string> = {
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  purple: 'bg-purple-500',
  neutral: 'bg-slate-400',
};

interface StatusBadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ tone, children, dot, className }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} ${className ?? ''}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClasses[tone]}`} />}
      {children}
    </span>
  );
}

// Shared status → tone/label mappings for the ProductUnit statuses (Available/
// Sold/Reserved). No "Returned"/"Repair" entries — those states don't exist
// in the UnitStatus enum, so they're never fabricated here.
export function unitStatusTone(status: 'IN_STOCK' | 'SOLD' | 'RESERVED'): BadgeTone {
  if (status === 'IN_STOCK') return 'success';
  if (status === 'SOLD') return 'info';
  return 'purple';
}

export function unitStatusLabel(status: 'IN_STOCK' | 'SOLD' | 'RESERVED'): string {
  if (status === 'IN_STOCK') return 'Available';
  if (status === 'SOLD') return 'Sold';
  return 'Reserved';
}

export function activeTone(isActive: boolean): BadgeTone {
  return isActive ? 'success' : 'neutral';
}
