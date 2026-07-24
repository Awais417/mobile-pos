import { ReactNode } from 'react';
import { XIcon } from '@/components/icons';

interface DrawerProps {
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Right-side slide-in panel for secondary/detail information (invoice
// details, device history) — used instead of cramming everything into a
// modal or an awkward inline-expand block.
export function Drawer({ title, subtitle, onClose, children, footer }: DrawerProps) {
  return (
    <div
      className="animate-modal-overlay-in fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-drawer-panel-in flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:max-w-lg"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            {title && <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <XIcon className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
