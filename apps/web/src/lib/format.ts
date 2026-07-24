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
