import { storageGet, storageSet } from '../lib/storage';
import { emit } from '../lib/bus';
import { FREE_SHIP, GIFT, GIFT_WRAP, PROMO } from '../data/config';
import { productById } from '../data/products';
import { lookById, lookPrice } from '../data/looks';
import { bundlePrice } from '../lib/format';

/**
 * Three line kinds. Colour is a true variant: the same product in two
 * colours lives on two separate lines.
 */
export type CartLine =
  | { kind: 'product'; key: string; productId: string; colorId?: string; qty: number }
  | { kind: 'look'; key: string; lookId: string; qty: number }
  | { kind: 'custom'; key: string; flowerId: string; vaseId: string; qty: number };

interface CartState {
  lines: CartLine[];
  giftWrap: boolean;
  giftMessage: string;
  giftChoice: string | null; // product id of the chosen free gift
  promoCode: string | null;
}

let state: CartState = storageGet<CartState>('cart', {
  lines: [],
  giftWrap: false,
  giftMessage: '',
  giftChoice: null,
  promoCode: null,
});

function persist(): void {
  storageSet('cart', state);
  emit('cart:change');
}

/* Line helpers ------------------------------------------------------- */

export function linePrice(line: CartLine): number {
  if (line.kind === 'product') return productById(line.productId)?.price ?? 0;
  if (line.kind === 'look') {
    const look = lookById(line.lookId);
    return look ? lookPrice(look) : 0;
  }
  const flower = productById(line.flowerId)?.price ?? 0;
  const vase = productById(line.vaseId)?.price ?? 0;
  return bundlePrice(flower + vase);
}

export function lineTotal(line: CartLine): number {
  return linePrice(line) * line.qty;
}

/** Max purchasable quantity for a line: the scarcest component's stock. */
export function maxQtyFor(line: CartLine): number {
  const stocks: number[] = [];
  const push = (id: string) => {
    const stock = productById(id)?.stock;
    if (stock !== undefined) stocks.push(stock);
  };
  if (line.kind === 'product') push(line.productId);
  else if (line.kind === 'look') lookById(line.lookId)?.items.forEach(push);
  else {
    push(line.flowerId);
    push(line.vaseId);
  }
  return stocks.length ? Math.min(...stocks) : 99;
}

/* Derived totals ------------------------------------------------------ */

/** Paid items before any code — the gross basis. */
export function itemsSubtotal(): number {
  return state.lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function promoApplied(): boolean {
  return state.promoCode === PROMO.code && state.lines.length > 0;
}

export function promoDiscount(): number {
  if (!promoApplied()) return 0;
  return Math.round(itemsSubtotal() * PROMO.rate * 100) / 100;
}

/** Paid items after discount — the basis for both reward thresholds. */
export function discountedSubtotal(): number {
  return itemsSubtotal() - promoDiscount();
}

export function wrapCost(): number {
  return state.giftWrap && state.lines.length ? GIFT_WRAP : 0;
}

export function freeShippingUnlocked(): boolean {
  return discountedSubtotal() >= FREE_SHIP;
}

export function giftUnlocked(): boolean {
  return discountedSubtotal() >= GIFT.threshold;
}

/** The active free gift, revoked silently whenever the cart drops below the threshold. */
export function activeGift(): string | null {
  return giftUnlocked() ? state.giftChoice : null;
}

export function cartTotal(): number {
  return discountedSubtotal() + wrapCost();
}

export function getPromoCode(): string | null {
  return state.promoCode;
}

/** Returns false when the code is not one of ours. */
export function applyPromoCode(code: string): boolean {
  if (code.trim().toUpperCase() !== PROMO.code) return false;
  state.promoCode = PROMO.code;
  persist();
  return true;
}

export function removePromoCode(): void {
  state.promoCode = null;
  persist();
}

export function cartCount(): number {
  return state.lines.reduce((sum, l) => sum + l.qty, 0);
}

export function getLines(): CartLine[] {
  return state.lines;
}

export function getGiftWrap(): { enabled: boolean; message: string } {
  return { enabled: state.giftWrap, message: state.giftMessage };
}

export function getGiftChoice(): string | null {
  return state.giftChoice;
}

/* Mutations ------------------------------------------------------------ */

export function addProduct(productId: string, colorId: string | undefined, qty = 1): void {
  const key = `p:${productId}:${colorId ?? '-'}`;
  const existing = state.lines.find((l) => l.key === key);
  if (existing) existing.qty = Math.min(existing.qty + qty, maxQtyFor(existing));
  else {
    const line: CartLine = { kind: 'product', key, productId, colorId, qty };
    line.qty = Math.min(qty, maxQtyFor(line));
    state.lines.push(line);
  }
  persist();
}

export function addLook(lookId: string, qty = 1): void {
  const key = `l:${lookId}`;
  const existing = state.lines.find((l) => l.key === key);
  if (existing) existing.qty += qty;
  else state.lines.push({ kind: 'look', key, lookId, qty });
  persist();
}

export function addCustomBundle(flowerId: string, vaseId: string, qty = 1): void {
  const key = `c:${flowerId}:${vaseId}`;
  const existing = state.lines.find((l) => l.key === key);
  if (existing) existing.qty += qty;
  else state.lines.push({ kind: 'custom', key, flowerId, vaseId, qty });
  persist();
}

export function setQty(key: string, qty: number): void {
  const line = state.lines.find((l) => l.key === key);
  if (!line) return;
  if (qty <= 0) state.lines = state.lines.filter((l) => l.key !== key);
  else line.qty = Math.min(qty, maxQtyFor(line));
  persist();
}

export function removeLine(key: string): void {
  state.lines = state.lines.filter((l) => l.key !== key);
  persist();
}

export function setGiftWrap(enabled: boolean): void {
  state.giftWrap = enabled;
  persist();
}

/** Preserved without re-render: called on input, persists quietly. */
export function setGiftMessage(message: string): void {
  state.giftMessage = message;
  storageSet('cart', state);
}

export function chooseGift(productId: string | null): void {
  state.giftChoice = productId;
  persist();
}
