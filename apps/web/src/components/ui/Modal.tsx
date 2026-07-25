import { ReactNode } from 'react';
import { XIcon } from '@/components/icons';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm', // confirmations
  md: 'sm:max-w-lg', // simple forms
  lg: 'sm:max-w-2xl', // product / checkout forms
  xl: 'sm:max-w-4xl', // wide checkout / summary flows
};

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  /** Optional badge/status rendered next to the title, before the close button — e.g. a StatusBadge on a "View" detail modal's header. */
  headerExtra?: ReactNode;
  /** Set true while a closing animation is in flight (consumer controls the unmount timeout). */
  closing?: boolean;
  /** Escape hatch for one-off cases (e.g. print-specific overrides) — rare, most callers don't need this. */
  overlayClassName?: string;
  panelClassName?: string;
}

// One shared modal implementation — replaces the two near-identical local
// `ModalShell`s (Products, Inventory) and the one-off modal blocks hand-rolled
// in the POS terminal (IMEI picker, payment, receipt).
export function Modal({
  title,
  onClose,
  children,
  size = 'md',
  footer,
  headerExtra,
  closing,
  overlayClassName,
  panelClassName,
}: ModalProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[1px] sm:items-center sm:p-6 ${
        closing ? 'animate-modal-overlay-out' : 'animate-modal-overlay-in'
      } ${overlayClassName ?? ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`my-4 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${sizeClasses[size]} ${
          closing ? 'animate-modal-panel-out' : 'animate-modal-panel-in'
        } ${panelClassName ?? ''}`}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-7 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <h2 id="modal-title" className="truncate text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {headerExtra}
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
        )}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-7 py-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 px-7 py-5">{footer}</div>}
      </div>
    </div>
  );
}
