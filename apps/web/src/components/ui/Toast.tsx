'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { AlertTriangleIcon, CheckCircleIcon, XIcon } from '@/components/icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Replaces the ad-hoc inline success/error banners (Products) and the one
// raw alert() (Sales History) with one consistent, non-duplicating toast
// system: const { showToast } = useToast(); showToast('success', 'Product added successfully.');
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const toneClasses: Record<ToastType, string> = {
  success: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  error: 'border-red-100 bg-red-50 text-red-800',
  info: 'border-blue-100 bg-blue-50 text-blue-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      // Skip duplicate toasts for the same action fired twice in a row.
      setToasts((prev) => {
        if (prev.some((t) => t.type === type && t.message === message)) return prev;
        const id = nextId.current++;
        setTimeout(() => dismiss(id), 4000);
        return [...prev, { id, type, message }];
      });
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-modal-panel-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg ${toneClasses[t.type]}`}
          >
            {t.type === 'error' ? (
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 text-sm font-medium">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-60 transition hover:opacity-100"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
