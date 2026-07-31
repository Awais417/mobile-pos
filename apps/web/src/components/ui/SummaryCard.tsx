import { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';
import { TrendingDownIcon, TrendingUpIcon } from '@/components/icons';

interface SummaryCardProps {
  label: string;
  value: string | number;
  // Optional second line below value — e.g. the exact amount when value
  // itself is a compact/rounded figure (Inventory Value). Omitted elsewhere.
  subValue?: string;
  icon: ComponentType<IconProps>;
  color?: string;
  trend?: { label: string; positive?: boolean };
}

// The KPI-card block duplicated (with tiny inconsistencies) across Dashboard,
// Inventory and Sales History — one definition now.
export function SummaryCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = 'bg-slate-100 text-slate-600',
  trend,
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className="mt-1 truncate text-2xl font-bold text-slate-900 sm:text-3xl"
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </div>
      {subValue && (
        <div className="mt-0.5 truncate text-xs text-slate-400" title={subValue}>
          {subValue}
        </div>
      )}
      {trend && (
        <div
          className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
            trend.positive ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {trend.positive ? (
            <TrendingUpIcon className="h-3.5 w-3.5" />
          ) : (
            <TrendingDownIcon className="h-3.5 w-3.5" />
          )}
          {trend.label}
        </div>
      )}
    </div>
  );
}
