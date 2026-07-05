import { t, tt, tp, getLocale } from '../i18n';
import { esc } from '../lib/dom';
import { money } from '../lib/format';
import { productById } from '../data/products';
import { looks, lookPrice, lookSeparateTotal } from '../data/looks';
import { ratingFor, bestReview } from '../data/reviews';
import { starsMarkup } from '../components/rating';
import { heroArt, editorialArt, pairArt, motifBloom, ugcArt } from '../components/art';
import { productCardMarkup, bindProductCards } from '../components/productCard';
import { trustStripMarkup, emailCaptureMarkup, bindEmailCapture, recentStripMarkup } from '../components/sections';

const UGC = [
  {
    productId: 'orchid-arrangement',
    handle: '@marloes.thuis',
    quote: 'Three weeks of watering before I knew.',
    quote_nl: 'Drie weken water gegeven voor ik het wist.',
  },
  {
    productId: 'calla-arrangement',
    handle: '@studio.noord',
    quote: 'A still life that stays still.',
    quote_nl: 'Een stilleven dat stil blijft.',
  },
  {
    productId: 'calla-stem',
    handle: '@huis_van_isa',
    quote: 'The quietest corner of the house.',
    quote_nl: 'De rustigste hoek van het huis.',
  },
];

export function renderHome(main: HTMLElement): void {
  const site = ratingFor();
  const quote = bestReview();
  const featured = ['orchid-arrangement', 'calla-arrangement', 'vase-travertine', 'orchid-stem']
    .map((id) => productById(id)!)
    .filter(Boolean);
  const nlLocale = getLocale() === 'nl';

  main.innerHTML = `
  <section class="container hero">
    <div class="hero-copy" data-rise>
      <span class="eyebrow">${t('hero.eyebrow')}</span>
      <h1>${t('hero.title')}</h1>
      <p class="lede">${t('hero.lede')}</p>
      <span class="hero-rating">${starsMarkup(site.average)}
        <span>${tt('hero.rating', { score: site.average, count: site.count })}</span></span>
      <a class="btn btn--primary" href="/shop">${t('hero.cta')}
        <svg class="btn-arrow" width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M0 5h14M10 1l4 4-4 4" stroke="currentColor"/></svg></a>
    </div>
    <div class="hero-art" data-parallax>${heroArt()}</div>
  </section>

  <section class="section on-porcelain">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">${t('home.looks.eyebrow')}</span>
        <h2>${t('home.looks.title')}</h2>
        <p class="lede">${t('home.looks.sub')}</p>
      </div>
      <div class="looks-band" data-grid-stagger>
        ${looks
          .map(
            (l) => `<a class="look-card" href="/looks">
              <span class="media">${pairArt(l.items[0], l.items[1])}</span>
              <span class="body">
                <h3 class="card-title">${esc(tp(l, 'name'))}</h3>
                <span class="card-sub">${esc(tp(l, 'blurb'))}</span>
                <span class="look-price"><span class="card-price">${money(lookPrice(l))}</span>
                  <s>${money(lookSeparateTotal(l))}</s></span>
              </span>
            </a>`,
          )
          .join('')}
      </div>
      <div style="margin-top:2.2rem"><a class="btn btn--ghost" href="/looks">${t('home.looks.cta')}</a></div>
    </div>
  </section>

  <section class="container section editorial-split">
    <div class="media" data-parallax-media><div class="art-wrap" data-parallax style="height:100%">${editorialArt()}</div></div>
    <div class="copy" data-rise>
      <span class="eyebrow">${t('home.editorial.eyebrow')}</span>
      <h2>${t('home.editorial.title')}</h2>
      <p class="lede">${t('home.editorial.body')}</p>
      <a class="btn btn--ghost" href="/story">${t('home.editorial.cta')}</a>
    </div>
  </section>

  <section class="interlude container">
    <div class="bloom-holder" data-bloom-draw>${motifBloom('bloom')}</div>
    <p class="caption">${t('home.interlude.caption')}</p>
  </section>

  <section class="section on-porcelain">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">${t('home.featured.eyebrow')}</span>
        <h2>${t('home.featured.title')}</h2>
      </div>
      <div class="product-grid featured-grid" data-grid-stagger data-featured>
        ${featured.map((p) => productCardMarkup(p)).join('')}
      </div>
      <div style="margin-top:2.2rem"><a class="btn btn--ghost" href="/shop">${t('home.featured.cta')}</a></div>
    </div>
  </section>

  <section class="quote-band">
    <div class="container" data-rise>
      <span class="eyebrow" style="color:var(--sage-soft);display:block;margin-bottom:1.6rem">${t('home.quote.eyebrow')}</span>
      <blockquote>“${esc(nlLocale ? quote.quote_nl : quote.quote)}”</blockquote>
      <cite>${esc(quote.name)}, ${esc(quote.location)} — ${esc(productById(quote.productId)?.name ?? '')}</cite>
    </div>
  </section>

  <section class="container section">
    <div class="section-head">
      <span class="eyebrow">${t('home.ugc.eyebrow')}</span>
      <h2>${t('home.ugc.title')}</h2>
      <p class="lede">${t('home.ugc.sub')}</p>
    </div>
    <div class="ugc-grid" data-grid-stagger>
      ${UGC.map((u, i) => {
        const p = productById(u.productId)!;
        return `<a class="ugc-tile" href="/product/${p.id}">
          <span class="media">${ugcArt(i, u.productId)}</span>
          <span class="ugc-quote">“${esc(nlLocale ? u.quote_nl : u.quote)}”</span>
          <span class="ugc-handle">${esc(u.handle)} · ${t('home.ugc.shopThis')}: ${esc(p.name)}</span>
        </a>`;
      }).join('')}
    </div>
  </section>

  ${trustStripMarkup()}
  <div style="height:clamp(2.5rem,6vw,4.5rem)"></div>
  ${emailCaptureMarkup()}
  ${recentStripMarkup()}`;

  bindProductCards(main, productById);
  bindEmailCapture(main);
}
