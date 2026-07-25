import { ReactNode } from 'react';
import { formSectionTitleClass } from './styles';

// Shared building blocks for read-only "View" detail modals (Phone Details,
// Product Details, Device Details, ...) — a labeled section containing a
// two-column grid of label/value pairs. One definition instead of each page
// re-styling its own <dl> so every View modal reads consistently: a small
// uppercase label above a larger, clearly readable value.
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-7 last:mb-0">
      <div className={`${formSectionTitleClass} mb-3.5`}>{title}</div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

export function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-base font-medium text-slate-900">{value}</dd>
    </div>
  );
}
