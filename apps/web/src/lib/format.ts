// Shared money/number formatting — sab jagah yehi use hona chahiye,
// taake Products, Inventory, Dashboard aur POS mein format hamesha ek jaisa rahe.

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return 'Rs 0';
  }

  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return '0';
  }

  return Math.round(amount).toLocaleString('en-PK');
}

// Compact form for very large amounts (e.g. Inventory Value) — Rs 950 / Rs
// 15.5K / Rs 8.25M / Rs 1.2B. Below 1,000 this is identical to
// formatCurrency; callers showing a compact value should also show the
// exact formatCurrency amount alongside it so nothing is ever hidden.
export function formatCompactCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return 'Rs 0';
  }

  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  const scale =
    abs >= 1_000_000_000
      ? { divisor: 1_000_000_000, suffix: 'B' }
      : abs >= 1_000_000
        ? { divisor: 1_000_000, suffix: 'M' }
        : abs >= 1_000
          ? { divisor: 1_000, suffix: 'K' }
          : null;

  if (!scale) {
    return formatCurrency(amount);
  }

  // parseFloat drops trailing zeros (8.20 -> 8.2, 1.00 -> 1) so the suffix
  // never shows a misleading fake precision.
  const scaled = parseFloat((abs / scale.divisor).toFixed(2));
  return `${sign}Rs ${scaled}${scale.suffix}`;
}

// Every price in this app is a whole rupee amount — there's no discount/tax
// math anywhere that legitimately needs cents. Use this at the boundary
// where a Prisma-Decimal-as-string price (e.g. product.salePrice,
// unit.salePrice) first becomes a JS number for real use (POS cart state,
// Edit Price field, totals) — not just display. This guarantees the exact
// value carried into the cart/edit field can never drift by a fraction of a
// rupee, regardless of how the string was serialized upstream.
export function toWholeRupees(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}
