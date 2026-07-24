import { ReactNode } from 'react';
import { errorClass, formSectionTitleClass, helperClass, labelClass } from './styles';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: ReactNode;
  htmlFor?: string;
}

// Label + input + error/helper wrapper — used across Add/Edit Product,
// Categories and Staff forms so field spacing and error styling never drifts.
export function FormField({ label, required, error, helper, children, htmlFor }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error ? <p className={errorClass}>{error}</p> : helper ? <p className={helperClass}>{helper}</p> : null}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
  columns?: 1 | 2;
}

// Section divider with title + two-column (desktop) / one-column (mobile)
// grid — the "Basic Information / Device Details / Pricing / Inventory"
// groupings in the product form.
export function FormSection({ title, children, columns = 2 }: FormSectionProps) {
  return (
    <div className="mb-6">
      <div className={`${formSectionTitleClass} mb-3`}>{title}</div>
      <div className={`grid grid-cols-1 gap-3 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {children}
      </div>
    </div>
  );
}
