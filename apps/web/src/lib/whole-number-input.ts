import type { KeyboardEvent, ClipboardEvent } from 'react';

// Shared helpers for numeric inputs that must never accept a decimal point
// (Cost Price, Sale Price, Quantity, Battery Health, etc. — this shop never
// deals in fractional rupees or fractional units). Prevention happens at the
// input level only — existing onChange/validation/min/max/step logic at each
// call site is untouched; these just stop "." from ever reaching it.

// Strips any decimal point from a raw input value before it reaches the
// existing onChange handler/state setter — the most reliable guard, since
// mobile keyboards don't always fire a proper keydown for "." reliably.
export function stripDecimalPoint(value: string): string {
  return value.replace(/\./g, '');
}

// Belt-and-suspenders: blocks the "." keystroke itself (desktop keyboards).
export function blockDecimalKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key === '.') {
    e.preventDefault();
  }
}

// Belt-and-suspenders: blocks pasting any clipboard text containing a ".".
export function blockDecimalPaste(e: ClipboardEvent<HTMLInputElement>): void {
  if (e.clipboardData.getData('text').includes('.')) {
    e.preventDefault();
  }
}
