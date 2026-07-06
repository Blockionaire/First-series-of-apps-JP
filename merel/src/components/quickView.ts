import type { Product } from '../data/products';
import { colorOf } from '../data/products';
import { t, tt, tp } from '../i18n';
import { esc } from '../lib/dom';
import { money } from '../lib/format';
import { addProduct } from '../state/cart';
import { productArt } from './art';
import { ratingLine } from './rating';
import { swatchesMarkup, bindSwatches } from './swatches';
import { openModal } from './modals';
import { showToast } from './toast';

/** Quick-view modal (≥560px; the button is hidden below that). */
export function openQuickView(p: Product, initialColorId?: string): void {
  let colorId = initialColorId ?? p.colors?.[0]?.id;
  let qty = 1;

  const { close, card } = openModal(
    `
    <div class="quickview-media" data-qv-art>${productArt(p, { colorHex: colorOf(p, colorId)?.hex })}</div>
    <div class="modal-pad" style="justify-content:center">
      <span class="eyebrow eyebrow--stone">${esc(tp(p, 'kind'))}</span>
      <h2 style="font-size:1.9rem">${esc(tp(p, 'name'))}</h2>
      ${ratingLine(p.id)}
      <p style="color:var(--cocoa);font-size:.92rem">${esc(tp(p, 'blurb'))}</p>
      <div class="pdp-price-row"><span class="pdp-price">${money(p.price)}</span></div>
      ${p.colors ? swatchesMarkup(p, colorId) : ''}
      <div style="display:flex;gap:.8rem;align-items:stretch">
        <span class="qty">
          <button data-qv-qty="-1" aria-label="−">−</button>
          <output data-qv-out>1</output>
          <button data-qv-qty="1" aria-label="+">+</button>
        </span>
        <button class="btn btn--primary" style="flex:1" data-qv-add>${t('pdp.add')}</button>
      </div>
      <a class="link-underline" href="/product/${p.id}" data-qv-details
        style="font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;align-self:flex-start">${t('qv.details')}</a>
    </div>`,
    { wide: true },
  );

  bindSwatches(card, (cid) => {
    colorId = cid;
    const art = card.querySelector<HTMLElement>('[data-qv-art]');
    if (art) art.innerHTML = productArt(p, { colorHex: colorOf(p, cid)?.hex });
  });

  const out = card.querySelector<HTMLElement>('[data-qv-out]')!;
  const maxQty = p.stock ?? 99;
  card.querySelectorAll<HTMLButtonElement>('[data-qv-qty]').forEach((btn) =>
    btn.addEventListener('click', () => {
      qty = Math.min(maxQty, Math.max(1, qty + Number(btn.dataset.qvQty)));
      out.textContent = String(qty);
    }),
  );

  card.querySelector('[data-qv-add]')?.addEventListener('click', () => {
    addProduct(p.id, colorId, qty);
    showToast(tt('toast.added', { name: tp(p, 'name') }));
    close();
  });

  card.querySelector('[data-qv-details]')?.addEventListener('click', () => close());
}
