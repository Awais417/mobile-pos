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
