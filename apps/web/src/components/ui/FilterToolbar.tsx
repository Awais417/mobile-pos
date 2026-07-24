import { ReactNode } from 'react';
import { FilterIcon } from '@/components/icons';

interface FilterToolbarProps {
  children: ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
}

// Compact, responsive filter row — one filter bar style reused everywhere
// instead of each page building its own <select> row from scratch.
export function FilterToolbar({ children, hasActiveFilters, onClear }: FilterToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 pr-1 text-xs font-medium text-slate-500">
        <FilterIcon className="h-3.5 w-3.5" />
        Filters
      </div>
      {children}
      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs font-medium text-primary hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
