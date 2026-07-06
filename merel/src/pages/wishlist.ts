import { t } from '../i18n';
import { productById } from '../data/products';
import { getWishlist } from '../state/prefs';
import { productCardMarkup, bindProductCards } from '../components/productCard';
import { motifSprout } from '../components/art';
import { recentStripMarkup } from '../components/sections';
import { on } from '../lib/bus';

export function renderWishlist(main: HTMLElement): () => void {
  function paint(): void {
    const saved = getWishlist()
      .map((id) => productById(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    main.innerHTML = `
    <section class="container section" style="padding-top:clamp(2rem,5vw,3.5rem)">
      <div class="section-head">
        <span class="eyebrow">Merèl</span>
        <h1 style="font-size:clamp(2.2rem,5vw,3.4rem)">${t('wishlist.title')}</h1>
        <p class="lede">${t('wishlist.sub')}</p>
      </div>
      ${
        saved.length
          ? `<div class="product-grid" data-grid-stagger data-wish-grid>
              ${saved.map((p) => productCardMarkup(p)).join('')}
            </div>`
          : `<div class="cart-empty" style="padding:4rem 1rem">
              ${motifSprout(44)}
              <p class="serif" style="font-size:1.3rem;font-style:italic">${t('wishlist.empty')}</p>
              <p class="lede" style="text-align:center">${t('wishlist.emptyBody')}</p>
              <a class="btn btn--primary" href="/shop">${t('nf.cta')}</a>
            </div>`
      }
    </section>
    ${recentStripMarkup()}`;

    bindProductCards(main, productById);
  }

  paint();
  // Un-hearting a card removes it from this page live.
  const off = on('wish:change', paint);
  return off;
}
