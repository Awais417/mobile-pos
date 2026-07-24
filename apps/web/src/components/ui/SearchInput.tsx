import { SearchIcon } from '@/components/icons';
import { inputClass } from './styles';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

// The icon+input search box — was hand-copied in Products, Inventory, POS
// Terminal and Sales History with slightly different padding each time.
export function SearchInput({ value, onChange, placeholder, className, autoFocus }: SearchInputProps) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${inputClass} pl-10`}
      />
    </div>
  );
}
