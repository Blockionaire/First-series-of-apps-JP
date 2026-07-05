import { t, tt, tp } from '../i18n';
import { esc, qs } from '../lib/dom';
import { money } from '../lib/format';
import { FREE_SHIP, GIFT, GIFT_WRAP } from '../data/config';
import { productById, colorOf } from '../data/products';
import { lookById, lookPrice } from '../data/looks';
import {
  getLines,
  linePrice,
  lineTotal,
  itemsSubtotal,
  cartTotal,
  freeShippingUnlocked,
  giftUnlocked,
  activeGift,
  getGiftChoice,
  getGiftWrap,
  setGiftWrap,
  setGiftMessage,
  chooseGift,
  setQty,
  removeLine,
  addProduct,
  type CartLine,
} from '../state/cart';
import { productArt, pairArt } from './art';
import { openCheckoutModal } from './modals';
import { showToast } from './toast';
import { registerOverlay, unregisterOverlay } from './overlay';

let drawer: HTMLElement | null = null;
let overlay: HTMLElement | null = null;
let isOpen = false;

function ensureDom(): void {
  if (drawer) return;
  overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.addEventListener('click', closeCartDrawer);
  drawer = document.createElement('aside');
  drawer.className = 'cart-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', t('cart.title'));
  document.body.append(overlay, drawer);
}

/* — Line rendering ----------------------------------------------------- */

function lineTitle(line: CartLine): string {
  if (line.kind === 'product') {
    const p = productById(line.productId);
    return p ? tp(p, 'name') : line.productId;
  }
  if (line.kind === 'look') {
    const look = lookById(line.lookId);
    return look ? tp(look, 'name') : line.lookId;
  }
  return t('looks.custom');
}

function lineSub(line: CartLine): string {
  if (line.kind === 'product') {
    const p = productById(line.productId);
    if (!p) return '';
    const color = colorOf(p, line.colorId);
    const kind = tp(p, 'kind');
    return color ? `${kind} · ${tt('cart.colour', { name: tp(color, 'name') })}` : kind;
  }
  const items =
    line.kind === 'look'
      ? (lookById(line.lookId)?.items ?? [])
      : [line.flowerId, line.vaseId];
  const names = items.map((id) => productById(id)?.name ?? id).join(' + ');
  return tt('cart.bundleContents', { items: names });
}

function lineThumb(line: CartLine): string {
  if (line.kind === 'product') {
    const p = productById(line.productId);
    if (!p) return '';
    return productArt(p, { colorHex: colorOf(p, line.colorId)?.hex });
  }
  const [flowerId, vaseId] =
    line.kind === 'look'
      ? (lookById(line.lookId)?.items ?? ['', ''])
      : [line.flowerId, line.vaseId];
  return pairArt(flowerId, vaseId);
}

function lineMarkup(line: CartLine): string {
  return `<div class="cart-line" data-line="${esc(line.key)}">
    <div class="cart-line-thumb">${lineThumb(line)}</div>
    <div class="cart-line-body">
      <div class="cart-line-title"><span>${esc(lineTitle(line))}</span><span>${money(lineTotal(line))}</span></div>
      <div class="cart-line-sub">${esc(lineSub(line))}</div>
      ${line.qty > 1 ? `<div class="cart-line-sub">${tt('cart.each', { price: money(linePrice(line)) })}</div>` : ''}
      <div class="cart-line-controls">
        <span class="qty qty--sm">
          <button data-qty="-1" aria-label="−">−</button>
          <output>${line.qty}</output>
          <button data-qty="1" aria-label="+">+</button>
        </span>
        <button class="line-remove" data-remove>${t('cart.remove')}</button>
      </div>
    </div>
  </div>`;
}

/* — Rewards tracker ------------------------------------------------------ */

function rewardsMarkup(): string {
  const subtotal = itemsSubtotal();
  const progress = Math.min(1, subtotal / GIFT.threshold);
  let message: string;
  if (subtotal >= GIFT.threshold) message = t('rewards.done');
  else if (subtotal >= FREE_SHIP) message = tt('rewards.gift', { amount: money(GIFT.threshold - subtotal) });
  else message = tt('rewards.ship', { amount: money(FREE_SHIP - subtotal) });

  const shipPct = (FREE_SHIP / GIFT.threshold) * 100;
  return `<div class="rewards">
    <div class="rewards-msg" aria-live="polite">${message}</div>
    <div class="rewards-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${GIFT.threshold}" aria-valuenow="${Math.min(subtotal, GIFT.threshold)}">
      <div class="rewards-fill" style="width:${progress * 100}%"></div>
      <div class="rewards-dot ${freeShippingUnlocked() ? 'is-hit' : ''}" style="left:${shipPct}%"></div>
      <div class="rewards-dot ${giftUnlocked() ? 'is-hit' : ''}" style="left:100%"></div>
    </div>
    <div class="rewards-labels">
      <span>${t('rewards.shipLabel')} ${money(FREE_SHIP)}</span>
      <span>${t('rewards.giftLabel')} ${money(GIFT.threshold)}</span>
    </div>
  </div>`;
}

/* — Gift chooser ----------------------------------------------------------- */

function giftMarkup(): string {
  if (!giftUnlocked()) return '';
  const chosen = getGiftChoice();
  if (chosen) {
    const p = productById(chosen);
    if (!p) return '';
    return `<div class="gift-box">
      <div class="gift-claim">
        <span class="thumb" style="width:44px;aspect-ratio:4/5;flex:none;border-radius:var(--radius);overflow:hidden">${productArt(p)}</span>
        <span>${tt('gift.yours', { name: esc(tp(p, 'name')) })}</span>
        <button class="change" data-gift-change>${t('gift.change')}</button>
      </div>
    </div>`;
  }
  return `<div class="gift-box">
    <h3>${t('gift.choose')}</h3>
    <p style="font-size:.78rem;color:var(--cocoa)">${t('gift.sub')}</p>
    ${GIFT.items
      .map((id) => {
        const p = productById(id);
        if (!p) return '';
        return `<button class="gift-option" data-gift-pick="${id}">
          <span class="thumb">${productArt(p)}</span>
          <span class="name">${esc(tp(p, 'name'))} — ${esc(tp(p, 'kind'))}</span>
          <span class="price"><s>${money(p.price)}</s><b>${t('gift.free')}</b></span>
        </button>`;
      })
      .join('')}
  </div>`;
}

/* — Upsell: paired vase missing from the cart -------------------------------- */

function upsellSuggestion(): string | null {
  const lines = getLines();
  const inCart = new Set<string>();
  for (const line of lines) {
    if (line.kind === 'product') inCart.add(line.productId);
    else if (line.kind === 'look') lookById(line.lookId)?.items.forEach((id) => inCart.add(id));
    else {
      inCart.add(line.flowerId);
      inCart.add(line.vaseId);
    }
  }
  for (const line of lines) {
    if (line.kind !== 'product') continue;
    const pair = productById(line.productId)?.pairsWith;
    if (pair && !inCart.has(pair)) return pair;
  }
  return null;
}

function upsellMarkup(): string {
  const id = upsellSuggestion();
  if (!id) return '';
  const p = productById(id);
  if (!p) return '';
  return `<div class="cart-upsell">
    <span class="eyebrow">${t('upsell.title')}</span>
    <div class="cross-sell" style="border:none;padding:0">
      <span class="thumb">${productArt(p)}</span>
      <span class="body"><b>${esc(tp(p, 'name'))}</b><span>${esc(tp(p, 'kind'))} · ${money(p.price)}</span></span>
      <button class="btn btn--ghost" data-upsell-add="${id}" style="padding:.6rem 1.1rem">${t('upsell.add')}</button>
    </div>
  </div>`;
}

/* — Drawer body ---------------------------------------------------------------- */

export function renderCartDrawer(): void {
  ensureDom();
  const lines = getLines();
  const wrap = getGiftWrap();
  const gift = activeGift();
  const giftProduct = gift ? productById(gift) : null;

  if (!lines.length) {
    drawer!.innerHTML = `
      <div class="drawer-head">
        <h2>${t('cart.title')}</h2>
        <button class="drawer-close" data-close>${t('nav.close')}</button>
      </div>
      <div class="drawer-body">
        <div class="cart-empty">
          <p class="serif" style="font-size:1.3rem;font-style:italic">${t('cart.empty')}</p>
          <a class="btn btn--primary" href="/shop" data-close-nav>${t('cart.emptyCta')}</a>
        </div>
      </div>`;
  } else {
    drawer!.innerHTML = `
      <div class="drawer-head">
        <h2>${t('cart.title')}</h2>
        <button class="drawer-close" data-close>${t('nav.close')}</button>
      </div>
      <div class="drawer-body">
        ${rewardsMarkup()}
        ${lines.map(lineMarkup).join('')}
        ${giftMarkup()}
        ${upsellMarkup()}
        <div class="wrap-row">
          <label class="wrap-toggle">
            <input type="checkbox" data-wrap ${wrap.enabled ? 'checked' : ''} />
            <span>${tt('wrap.label', { price: money(GIFT_WRAP) })}</span>
          </label>
          ${
            wrap.enabled
              ? `<textarea class="field" rows="2" data-wrap-msg
                  placeholder="${esc(t('wrap.message'))}">${esc(wrap.message)}</textarea>`
              : ''
          }
        </div>
      </div>
      <div class="drawer-foot">
        <div class="summary-line"><span>${t('cart.subtotal')}</span><span>${money(itemsSubtotal())}</span></div>
        ${
          giftProduct
            ? `<div class="summary-line"><span>${tt('gift.line', { name: esc(tp(giftProduct, 'name')) })}</span><span class="free">${t('gift.free')}</span></div>`
            : ''
        }
        ${wrap.enabled ? `<div class="summary-line"><span>${t('wrap.line')}</span><span>${money(GIFT_WRAP)}</span></div>` : ''}
        <div class="summary-line"><span>${t('cart.shipping')}</span>
          <span>${freeShippingUnlocked() ? `<span class="free">${t('cart.shippingFree')}</span>` : t('cart.shippingAt')}</span></div>
        <div class="summary-line total"><span>${t('cart.total')}</span><span>${money(cartTotal())}</span></div>
        <button class="btn btn--primary btn--full" data-checkout>${t('cart.checkout')}</button>
        <p style="font-size:.68rem;color:var(--stone);text-align:center">${t('cart.vat')}</p>
      </div>`;
  }

  bindDrawer();
}

function bindDrawer(): void {
  const root = drawer!;
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeCartDrawer));
  root.querySelector('[data-close-nav]')?.addEventListener('click', closeCartDrawer);

  root.querySelectorAll<HTMLElement>('[data-line]').forEach((lineEl) => {
    const key = lineEl.dataset.line!;
    lineEl.querySelectorAll<HTMLButtonElement>('[data-qty]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const line = getLines().find((l) => l.key === key);
        if (line) setQty(key, line.qty + Number(btn.dataset.qty));
      }),
    );
    lineEl.querySelector('[data-remove]')?.addEventListener('click', () => removeLine(key));
  });

  root.querySelectorAll<HTMLButtonElement>('[data-gift-pick]').forEach((btn) =>
    btn.addEventListener('click', () => {
      chooseGift(btn.dataset.giftPick!);
      showToast(t('toast.gift'));
    }),
  );
  root.querySelector('[data-gift-change]')?.addEventListener('click', () => chooseGift(null));

  root.querySelectorAll<HTMLButtonElement>('[data-upsell-add]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = productById(btn.dataset.upsellAdd!);
      if (!p) return;
      addProduct(p.id, p.colors?.[0]?.id);
      showToast(tt('toast.added', { name: tp(p, 'name') }));
    }),
  );

  root.querySelector<HTMLInputElement>('[data-wrap]')?.addEventListener('change', (e) => {
    setGiftWrap((e.target as HTMLInputElement).checked);
  });
  // Message persists on input without re-rendering the drawer.
  root.querySelector<HTMLTextAreaElement>('[data-wrap-msg]')?.addEventListener('input', (e) => {
    setGiftMessage((e.target as HTMLTextAreaElement).value);
  });

  root.querySelector('[data-checkout]')?.addEventListener('click', openCheckoutModal);
}

/* — Open / close ------------------------------------------------------------------ */

export function openCartDrawer(): void {
  ensureDom();
  renderCartDrawer();
  isOpen = true;
  overlay!.classList.add('is-open');
  drawer!.classList.add('is-open');
  registerOverlay(drawer!, closeCartDrawer);
  qs<HTMLElement>(drawer!, '.drawer-close').focus();
}

export function closeCartDrawer(): void {
  if (!isOpen) return;
  isOpen = false;
  overlay?.classList.remove('is-open');
  drawer?.classList.remove('is-open');
  unregisterOverlay(drawer!);
}

export function cartDrawerIsOpen(): boolean {
  return isOpen;
}
