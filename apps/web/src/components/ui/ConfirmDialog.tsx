import { ReactNode } from 'react';
import { Loader2Icon } from '@/components/icons';
import { Modal } from './Modal';
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from './styles';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra content (e.g. a reason field) rendered between the description and buttons. */
  children?: ReactNode;
}

// Replaces raw browser confirm()/alert() (previously only used in Sales
// History) and the ad-hoc "confirm-delete" modal states hand-rolled per page.
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      {description && <p className="text-sm text-slate-500">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={`flex-1 ${secondaryButtonClass}`}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 ${variant === 'danger' ? dangerButtonClass : primaryButtonClass}`}
        >
          {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
