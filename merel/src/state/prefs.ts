import { storageGet, storageSet } from '../lib/storage';
import { emit } from '../lib/bus';

/* Recently viewed ------------------------------------------------------ */

export interface RecentEntry {
  productId: string;
  colorId?: string;
}

const RECENT_MAX = 8;

export function getRecent(): RecentEntry[] {
  return storageGet<RecentEntry[]>('recent', []);
}

export function pushRecent(productId: string, colorId?: string): void {
  const list = getRecent().filter((e) => e.productId !== productId);
  list.unshift({ productId, colorId });
  storageSet('recent', list.slice(0, RECENT_MAX));
  emit('recent:change');
}

/** Tiles remember the colourway last chosen on the PDP. */
export function updateRecentColor(productId: string, colorId: string): void {
  const list = getRecent();
  const entry = list.find((e) => e.productId === productId);
  if (entry) {
    entry.colorId = colorId;
    storageSet('recent', list);
  }
}

/* Wishlist --------------------------------------------------------------- */

export function getWishlist(): string[] {
  return storageGet<string[]>('wishlist', []);
}

export function inWishlist(productId: string): boolean {
  return getWishlist().includes(productId);
}

/** Returns the new state: true = now saved. */
export function toggleWishlist(productId: string): boolean {
  const list = getWishlist();
  const index = list.indexOf(productId);
  if (index === -1) list.unshift(productId);
  else list.splice(index, 1);
  storageSet('wishlist', list);
  emit('wish:change');
  return index === -1;
}

/* Newsletter / promo ---------------------------------------------------- */

export function isSubscribed(): boolean {
  return storageGet<boolean>('subscribed', false);
}

export function setSubscribed(): void {
  storageSet('subscribed', true);
}

export function promoShown(): boolean {
  return storageGet<boolean>('promo-shown', false);
}

export function markPromoShown(): void {
  storageSet('promo-shown', true);
}
