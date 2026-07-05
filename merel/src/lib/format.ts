/**
 * EUR formatting, nl-NL convention: "€1.234" — dot as thousands separator,
 * no decimals for whole euro amounts (all catalogue prices are whole euros).
 */
export function money(amount: number): string {
  const whole = Math.round(amount * 100) % 100 === 0;
  const formatted = new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
  return `€${formatted}`;
}

/** Bundle pricing: ~10% off the separate total, rounded to the nearest €5. */
export function bundlePrice(separateTotal: number): number {
  return Math.round((separateTotal * 0.9) / 5) * 5;
}
