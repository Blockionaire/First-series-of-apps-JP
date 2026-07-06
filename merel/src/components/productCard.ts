import type { Product } from '../data/products';
import { colorOf } from '../data/products';
import { t, tp } from '../i18n';
import { money } from '../lib/format';
import { esc } from '../lib/dom';
import { productArt } from './art';
import { ratingLine } from './rating';
import { swatchesMarkup, bindSwatches } from './swatches';
import { openQuickView } from './quickView';
import { wishButtonMarkup, bindWishButtons } from './wishButton';

export function productCardMarkup(p: Product, colorId?: string): string {
  const color = colorOf(p, colorId);
  return `<article class="product-card" data-card="${p.id}">
    <a class="card-media" href="/product/${p.id}" data-card-link aria-label="${esc(tp(p, 'name'))}">
      <div class="card-layer" data-card-art>${productArt(p, { colorHex: color?.hex })}</div>
      <div class="card-layer card-layer--alt" data-card-alt aria-hidden="true">${productArt(p, { variant: 'room', colorHex: color?.hex })}</div>
      ${wishButtonMarkup(p.id, 'wish-btn--card')}
      <button type="button" class="quickview-btn" data-quickview>${t('shop.quickview')}</button>
    </a>
    <div class="card-body">
      <div class="card-meta">
        <h3 class="card-title"><a href="/product/${p.id}">${esc(tp(p, 'name'))}</a></h3>
        ${p.signature ? `<span class="badge">${t('shop.signature')}</span>` : ''}
      </div>
      <div class="card-sub">${esc(tp(p, 'kind'))}</div>
      ${ratingLine(p.id)}
      <div class="card-meta">
        <span class="card-price">${money(p.price)}</span>
        ${swatchesMarkup(p, colorId)}
      </div>
    </div>
  </article>`;
}

/** Wires swatch retint, wishlist heart and quick view on every card inside `root`. */
export function bindProductCards(root: HTMLElement, resolve: (id: string) => Product | undefined): void {
  root.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
    const product = resolve(card.dataset.card!);
    if (!product) return;

    bindSwatches(card, (cid) => {
      const color = colorOf(product, cid);
      if (!color) return;
      const art = card.querySelector<HTMLElement>('[data-card-art]');
      if (art) art.innerHTML = productArt(product, { colorHex: color.hex });
      const alt = card.querySelector<HTMLElement>('[data-card-alt]');
      if (alt) alt.innerHTML = productArt(product, { variant: 'room', colorHex: color.hex });
      card.dataset.color = cid;
    });

    // Quick view must not trigger the card's link navigation.
    card.querySelector('[data-quickview]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openQuickView(product, card.dataset.color);
    });
  });

  bindWishButtons(root);
}
