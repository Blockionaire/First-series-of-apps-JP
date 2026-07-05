import { t, tt, tp, getLocale } from '../i18n';
import { esc, qs, reducedMotion } from '../lib/dom';
import { money } from '../lib/format';
import { CUTOFF_HOUR, GIFT } from '../data/config';
import { productById, colorOf, products, type Product } from '../data/products';
import { ratingFor, reviewsFor } from '../data/reviews';
import { addProduct, itemsSubtotal } from '../state/cart';
import { pushRecent, updateRecentColor } from '../state/prefs';
import { productArt, type ArtVariant } from '../components/art';
import { starsMarkup } from '../components/rating';
import { swatchesMarkup, bindSwatches } from '../components/swatches';
import { productCardMarkup, bindProductCards } from '../components/productCard';
import { recentStripMarkup } from '../components/sections';
import { openLightbox } from '../components/lightbox';
import { showToast } from '../components/toast';
import { on } from '../lib/bus';

type MediaSlot = ArtVariant | '3d';

/* — Delivery countdown: 16:00 cutoff, Sundays skipped -------------------- */
function nextDelivery(now: Date): { cutoff: Date; deliveryDay: number; isTomorrow: boolean } {
  const cutoff = new Date(now);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
  if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);

  const delivery = new Date(cutoff);
  delivery.setDate(delivery.getDate() + 1);
  if (delivery.getDay() === 0) delivery.setDate(delivery.getDate() + 1); // never on Sunday

  const dayDiff = Math.round(
    (new Date(delivery).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000,
  );
  return { cutoff, deliveryDay: delivery.getDay(), isTomorrow: dayDiff === 1 };
}

function countdownText(): string {
  const now = new Date();
  const { cutoff, deliveryDay, isTomorrow } = nextDelivery(now);
  const mins = Math.max(0, Math.floor((cutoff.getTime() - now.getTime()) / 60000));
  const time = tt('pdp.countdown.time', { h: Math.floor(mins / 60), m: mins % 60 });
  const day = isTomorrow ? t('day.tomorrow') : t(`day.${deliveryDay}` as 'day.1');
  return tt('pdp.countdown', { time: `<b>${time}</b>`, day: `<b>${day}</b>` });
}

/* — Media ------------------------------------------------------------------ */

function slotsFor(p: Product): MediaSlot[] {
  const gallery: MediaSlot[] = ['front', 'detail', 'room', 'video', 'compare'];
  return p.model ? ['3d', ...gallery] : gallery;
}

function slotLabel(slot: MediaSlot): string {
  return t(`pdp.media.${slot === '3d' ? '3d' : slot}` as 'pdp.media.front');
}

function artForSlot(p: Product, slot: MediaSlot, colorHex?: string): string {
  const variant: ArtVariant = slot === '3d' ? 'front' : slot;
  return productArt(p, {
    variant,
    colorHex,
    labels: { fresh: t('pdp.compare.fresh'), merel: t('pdp.compare.merel') },
  });
}

/* — Page ------------------------------------------------------------------- */

export function renderProduct(main: HTMLElement, id: string): (() => void) | void {
  const p = productById(id);
  if (!p) {
    main.innerHTML = `<section class="container section"><p class="shop-empty">${t('shop.empty')}</p></section>`;
    return;
  }

  let colorId = p.colors?.[0]?.id;
  let qty = 1;
  let activeSlot: MediaSlot = slotsFor(p)[0];
  let viewerCleanup: (() => void) | null = null;
  const rating = ratingFor(p.id);
  const productReviews = reviewsFor(p.id);
  const paired = p.pairsWith ? productById(p.pairsWith) : undefined;
  const alsoLike = products.filter((x) => x.id !== p.id && x.category !== p.category).slice(0, 3);
  const nlLocale = getLocale() === 'nl';

  pushRecent(p.id, colorId);

  const giftGap = GIFT.threshold - itemsSubtotal();

  main.innerHTML = `
  <section class="container pdp">
    <div class="pdp-media">
      <div class="pdp-stage" data-stage></div>
      <div class="pdp-thumbs" data-thumbs>
        ${slotsFor(p)
          .map(
            (slot) => `<button class="pdp-thumb" data-slot="${slot}" aria-pressed="${slot === activeSlot}"
              aria-label="${esc(slotLabel(slot))}">
              ${slot === '3d'
                ? `<span class="art" style="display:grid;place-items:center;font-size:.72rem;letter-spacing:.1em;color:var(--sage)">3D</span>`
                : artForSlot(p, slot, colorOf(p, colorId)?.hex)}
              <span class="tag">${esc(slotLabel(slot))}</span>
            </button>`,
          )
          .join('')}
      </div>
    </div>

    <div class="pdp-panel">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">${t('pdp.home')}</a><span>/</span><a href="/shop">${t('pdp.shop')}</a><span>/</span><span>${esc(tp(p, 'name'))}</span>
      </nav>
      <h1 class="pdp-title">${esc(tp(p, 'name'))} <span class="muted" style="font-size:.55em">— ${esc(tp(p, 'kind'))}</span></h1>
      ${
        rating.count
          ? `<a href="#reviews" class="rating-line" data-reviews-link>${starsMarkup(rating.average)}
              <span>${rating.average} · ${tt('pdp.reviewsLink', { count: rating.count })}</span></a>`
          : ''
      }
      <p class="lede" style="font-size:.98rem">${esc(tp(p, 'description'))}</p>
      <p class="pdp-dims">${esc(tp(p, 'dims'))}</p>
      <div class="pdp-price-row">
        <span class="pdp-price">${money(p.price)}</span>
        <span class="pdp-delivery">${t('pdp.delivery')}</span>
      </div>

      ${
        p.colors
          ? `<div class="color-picker">
              <span class="label">${t('pdp.colour')}: <b data-color-name>${esc(tp(colorOf(p, colorId)!, 'name'))}</b></span>
              ${swatchesMarkup(p, colorId, true)}
            </div>`
          : ''
      }

      <div class="pdp-buy">
        <span class="qty">
          <button data-qty="-1" aria-label="−">−</button>
          <output data-qty-out aria-label="${t('pdp.qty')}">1</output>
          <button data-qty="1" aria-label="+">+</button>
        </span>
        <button class="btn btn--primary" data-add>${t('pdp.add')}
          <svg class="btn-arrow" width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M0 5h14M10 1l4 4-4 4" stroke="currentColor"/></svg>
        </button>
      </div>

      ${p.stock !== undefined && p.stock <= 6 ? `<p class="low-stock">${tt('pdp.lowStock', { n: p.stock })}</p>` : ''}
      <p class="countdown" data-countdown>${countdownText()}</p>
      ${
        giftGap > 0
          ? `<p class="gift-nudge">✦ ${tt('pdp.giftNudge', { amount: money(giftGap) })}</p>`
          : ''
      }

      <ul class="guarantees">
        ${[1, 2, 3, 4].map((i) => `<li>${t(`pdp.guarantee.${i}` as 'pdp.guarantee.1')}</li>`).join('')}
      </ul>

      ${
        paired
          ? `<div class="cross-sell">
              <span class="thumb">${productArt(paired)}</span>
              <span class="body"><span class="eyebrow eyebrow--stone" style="font-size:.6rem">${t('pdp.completeLook')}</span>
                <b>${esc(tp(paired, 'name'))}</b>
                <span>${esc(tp(paired, 'kind'))} · ${money(paired.price)}</span></span>
              <button class="btn btn--ghost" data-add-paired style="padding:.6rem 1.1rem">${t('pdp.addVase')}</button>
            </div>`
          : ''
      }

      <div>
        <details class="accordion"><summary>${t('pdp.acc.details')}</summary>
          <div class="accordion-body">${esc(tp(p, 'description'))}\n\n${esc(tp(p, 'dims'))}</div></details>
        <details class="accordion"><summary>${t('pdp.acc.care')}</summary>
          <div class="accordion-body">${esc(tp(p, 'care'))}</div></details>
        <details class="accordion"><summary>${t('pdp.acc.shipping')}</summary>
          <div class="accordion-body">${esc(tp(p, 'ship'))}</div></details>
      </div>
    </div>
  </section>

  <section class="reviews" id="reviews">
    <div class="container">
      <div class="section-head"><span class="eyebrow">${t('pdp.reviews.title')}</span></div>
      ${
        rating.count
          ? `<div class="reviews-summary">
              <div class="reviews-score">
                <div class="num">${rating.average}</div>
                ${starsMarkup(rating.average)}
                <div class="sub">${tt('pdp.reviews.based', { count: rating.count })}</div>
              </div>
              <div>
                ${[5, 4, 3, 2, 1]
                  .map((s) => {
                    const n = rating.distribution[s as 5];
                    const pct = rating.count ? (n / rating.count) * 100 : 0;
                    return `<div class="dist-row"><span>${s} ★</span><span class="dist-bar"><i style="width:${pct}%"></i></span><span>${n}</span></div>`;
                  })
                  .join('')}
              </div>
            </div>
            ${productReviews
              .map(
                (r) => `<article class="review-card">
                  <div class="review-head">
                    ${starsMarkup(r.rating)}
                    <span class="name">${esc(r.name)} · ${esc(r.location)}</span>
                    ${r.verified ? `<span class="verified">✓ ${t('pdp.verified')}</span>` : ''}
                    <span class="muted" style="font-size:.72rem">${r.date}</span>
                  </div>
                  <p class="review-quote">“${esc(nlLocale ? r.quote_nl : r.quote)}”</p>
                  ${r.photo ? `<div class="review-photo">${productArt(p, { variant: 'room', colorHex: colorOf(p, colorId)?.hex })}</div>` : ''}
                </article>`,
              )
              .join('')}`
          : `<p class="lede">${t('pdp.reviews.none')}</p>`
      }
    </div>
  </section>

  <section class="container section" style="padding-top:0">
    <div class="section-head"><span class="eyebrow">${t('pdp.alsoLike')}</span></div>
    <div class="product-grid" data-also data-grid-stagger>
      ${alsoLike.map((x) => productCardMarkup(x)).join('')}
    </div>
  </section>

  ${recentStripMarkup(p.id)}

  <div class="sticky-atc" data-sticky-atc>
    <span class="info"><b>${esc(tp(p, 'name'))}</b><span>${money(p.price)}</span></span>
    <button class="btn btn--primary" data-add-sticky>${t('pdp.add')}</button>
  </div>`;

  /* — Media wiring ---------------------------------------------------------- */
  const stage = qs<HTMLElement>(main, '[data-stage]');

  async function showSlot(slot: MediaSlot): Promise<void> {
    activeSlot = slot;
    main.querySelectorAll('[data-slot]').forEach((b) =>
      b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.slot === slot)),
    );
    viewerCleanup?.();
    viewerCleanup = null;

    if (slot === '3d' && p!.model) {
      // Poster while the (lazy-loaded) engine boots.
      stage.innerHTML = artForSlot(p!, 'front', colorOf(p!, colorId)?.hex);
      try {
        const { mountViewer } = await import('../components/viewer3d');
        if (activeSlot !== '3d') return; // user moved on mid-load
        viewerCleanup = await mountViewer(stage, `/assets/models/${p!.model}`, {
          hint: t('pdp.viewerHint'),
        });
      } catch {
        // Engine or model failed to load — the 2D poster stays.
      }
      return;
    }
    stage.innerHTML = artForSlot(p!, slot, colorOf(p!, colorId)?.hex);
    stage.style.cursor = 'zoom-in';
    const currentSlot = slot;
    stage.onclick = () => openLightbox(artForSlot(p!, currentSlot, colorOf(p!, colorId)?.hex));
  }

  main.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((btn) =>
    btn.addEventListener('click', () => void showSlot(btn.dataset.slot as MediaSlot)),
  );
  void showSlot(activeSlot);

  /* — Colour: retints media + updates label + remembers on the recent tile — */
  bindSwatches(qs(main, '.pdp-panel'), (cid) => {
    colorId = cid;
    const color = colorOf(p, cid);
    const label = main.querySelector('[data-color-name]');
    if (label && color) label.textContent = tp(color, 'name');
    updateRecentColor(p.id, cid);
    if (activeSlot !== '3d') void showSlot(activeSlot);
    main.querySelectorAll<HTMLElement>('[data-thumbs] [data-slot]').forEach((thumb) => {
      const slot = thumb.dataset.slot as MediaSlot;
      if (slot === '3d') return;
      const art = thumb.querySelector('.art');
      if (art) art.outerHTML = artForSlot(p, slot, color?.hex);
    });
  });

  /* — Qty + add to cart ------------------------------------------------------ */
  const qtyOut = qs<HTMLElement>(main, '[data-qty-out]');
  main.querySelectorAll<HTMLButtonElement>('.pdp-buy [data-qty]').forEach((btn) =>
    btn.addEventListener('click', () => {
      qty = Math.max(1, qty + Number(btn.dataset.qty));
      qtyOut.textContent = String(qty);
    }),
  );

  const doAdd = () => {
    addProduct(p.id, colorId, qty);
    showToast(tt('toast.added', { name: tp(p, 'name') }));
  };
  qs<HTMLElement>(main, '[data-add]').addEventListener('click', doAdd);
  main.querySelector('[data-add-sticky]')?.addEventListener('click', doAdd);

  main.querySelector('[data-add-paired]')?.addEventListener('click', () => {
    if (!paired) return;
    addProduct(paired.id, paired.colors?.[0]?.id);
    showToast(tt('toast.added', { name: tp(paired, 'name') }));
  });

  /* — Reviews anchor --------------------------------------------------------- */
  main.querySelector('[data-reviews-link]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('reviews')?.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  });

  /* — Sticky mobile add-to-cart bar ------------------------------------------- */
  const stickyBar = qs<HTMLElement>(main, '[data-sticky-atc]');
  const buyBtn = qs<HTMLElement>(main, '[data-add]');
  const observer = new IntersectionObserver(
    ([entry]) => stickyBar.classList.toggle('is-visible', !entry.isIntersecting),
    { threshold: 0 },
  );
  observer.observe(buyBtn);

  /* — Countdown tick ------------------------------------------------------------ */
  const countdownEl = qs<HTMLElement>(main, '[data-countdown]');
  const tick = window.setInterval(() => {
    countdownEl.innerHTML = countdownText();
  }, 30000);

  bindProductCards(qs(main, '[data-also]'), productById);

  /* — Gift nudge stays honest when the cart changes under us -------------------- */
  const offCart = on('cart:change', () => {
    const nudge = main.querySelector<HTMLElement>('.gift-nudge');
    const gap = GIFT.threshold - itemsSubtotal();
    if (nudge) {
      if (gap > 0) nudge.innerHTML = `✦ ${tt('pdp.giftNudge', { amount: money(gap) })}`;
      else nudge.remove();
    }
  });

  return () => {
    window.clearInterval(tick);
    observer.disconnect();
    viewerCleanup?.();
    offCart();
  };
}
