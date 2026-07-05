/** Commerce constants. Prices in EUR, VAT-inclusive. */
export const FREE_SHIP = 75;
export const GIFT_WRAP = 6;

export const GIFT = {
  threshold: 175,
  items: ['calla-stem', 'orchid-stem', 'vase-glass'],
} as const;

/** Order cutoff for next-day delivery (local time, 24h). Sundays skipped. */
export const CUTOFF_HOUR = 16;
