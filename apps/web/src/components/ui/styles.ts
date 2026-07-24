// Shared class-name tokens — the single source of truth for input/label/button
// styling, so every page/form looks and behaves identically instead of each
// page redefining its own local `inputClass` etc.

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-soft disabled:bg-slate-50 disabled:text-slate-400';

export const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

export const errorClass = 'mt-1 text-xs text-red-600';

export const helperClass = 'mt-1 text-xs text-slate-500';

// Page-level section headings (e.g. "Sales Overview" panel title)
export const panelTitleClass = 'text-lg font-semibold text-slate-900';

// Form subsection headings (e.g. "Basic Information" inside a product form)
export const formSectionTitleClass = 'text-sm font-semibold text-slate-800';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';

export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60';

export const ghostButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60';

export const cardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
