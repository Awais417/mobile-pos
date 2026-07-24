import { ComponentType } from 'react';
import type { IconProps } from '@/components/icons';

type ActionVariant = 'view' | 'edit' | 'delete' | 'neutral';

interface ActionItem {
  label: string;
  icon: ComponentType<IconProps>;
  onClick: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
}

const variantClasses: Record<ActionVariant, string> = {
  view: 'hover:bg-blue-50 hover:text-blue-600',
  edit: 'hover:border-[#86efac] hover:bg-[#f0fdf4] hover:text-[#16a34a]',
  delete: 'hover:bg-red-50 hover:text-red-600',
  neutral: 'hover:bg-slate-100 hover:text-slate-700',
};

// The View(blue)/Edit(green)/Delete(red) icon-button row — was hand-copied
// with slightly different colors in Products/Inventory/Categories/Sales.
export function ActionMenu({ actions }: { actions: ActionItem[] }) {
  return (
    <div className="flex items-center gap-1">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            aria-label={a.label}
            title={a.label}
            className={`cursor-pointer rounded-lg border border-transparent p-1.5 text-slate-400 transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 ${variantClasses[a.variant ?? 'neutral']}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
