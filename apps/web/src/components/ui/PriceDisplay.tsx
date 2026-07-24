import { formatCurrency } from '@/lib/format';

type PriceSize = 'sm' | 'md' | 'lg' | 'xl';
type PriceTone = 'default' | 'muted' | 'success' | 'danger';

const sizeClasses: Record<PriceSize, string> = {
  sm: 'text-sm',
  md: 'text-base font-semibold',
  lg: 'text-xl font-bold',
  xl: 'text-2xl font-bold sm:text-3xl',
};

const toneClasses: Record<PriceTone, string> = {
  default: 'text-slate-900',
  muted: 'text-slate-500',
  success: 'text-emerald-600',
  danger: 'text-red-600',
};

interface PriceDisplayProps {
  value: number | string | null | undefined;
  size?: PriceSize;
  tone?: PriceTone;
  className?: string;
}

// Thin, consistent wrapper around formatCurrency so metric/table/card price
// text always uses the same size+weight+color conventions.
export function PriceDisplay({ value, size = 'md', tone = 'default', className }: PriceDisplayProps) {
  return (
    <span className={`${sizeClasses[size]} ${toneClasses[tone]} ${className ?? ''}`}>
      {formatCurrency(value)}
    </span>
  );
}
