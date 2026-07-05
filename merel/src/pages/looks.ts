import { t, tt, tp } from '../i18n';
import { esc, qs } from '../lib/dom';
import { money, bundlePrice } from '../lib/format';
import { products, productById } from '../data/products';
import { looks, lookPrice, lookSeparateTotal } from '../data/looks';
import { addLook, addCustomBundle } from '../state/cart';
import { pairArt } from '../components/art';
import { trustStripMarkup, recentStripMarkup } from '../components/sections';
import { showToast } from '../components/toast';

export function renderLooks(main: HTMLElement): void {
  const flowers = products.filter((p) => p.category !== 'vases');
  const vases = products.filter((p) => p.category === 'vases');
  let flowerId = flowers[0].id;
  let vaseId = productById(flowers[0].pairsWith ?? '')?.id ?? vases[0].id;

  main.innerHTML = `
  <section class="container section" style="padding-top:clamp(2rem,5vw,3.5rem)">
    <div class="section-head">
      <span class="eyebrow">Merèl</span>
      <h1 style="font-size:clamp(2.2rem,5vw,3.4rem)">${t('looks.title')}</h1>
      <p class="lede">${t('looks.sub')}</p>
    </div>

    <div class="looks-band" data-grid-stagger>
      ${looks
        .map((l) => {
          const separate = lookSeparateTotal(l);
          const bundled = lookPrice(l);
          const names = l.items.map((id) => {
            const item = productById(id)!;
            return `${item.name} — ${tp(item, 'kind')}`;
          });
          return `<article class="look-card">
            <div class="media">${pairArt(l.items[0], l.items[1])}</div>
            <div class="body">
              <h2 class="card-title" style="font-size:1.5rem">${esc(tp(l, 'name'))}</h2>
              <span class="card-sub">${esc(tp(l, 'blurb'))}</span>
              <span class="card-sub">${t('looks.contains')}: ${esc(names.join(' · '))}</span>
              <span class="look-price">
                <span class="card-price" style="font-size:1.15rem">${money(bundled)}</span>
                <s>${tt('looks.separately', { amount: money(separate) })}</s>
              </span>
              <span class="look-saving">${tt('looks.save', { amount: money(separate - bundled) })}</span>
              <button class="btn btn--primary" data-add-look="${l.id}" style="margin-top:.6rem;align-self:flex-start">${t('looks.add')}</button>
            </div>
          </article>`;
        })
        .join('')}
    </div>
  </section>

  <section class="section on-porcelain">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">${t('looks.config.eyebrow')}</span>
        <h2>${t('looks.config.title')}</h2>
        <p class="lede">${t('looks.config.sub')}</p>
      </div>
      <div class="configurator">
        <div class="config-preview" data-config-preview></div>
        <div class="config-controls">
          <div class="config-group">
            <span class="eyebrow eyebrow--stone">${t('looks.config.flower')}</span>
            <div class="chips" data-flower-chips>
              ${flowers
                .map(
                  (f) => `<button class="chip" data-flower="${f.id}" aria-pressed="${f.id === flowerId}">
                    ${esc(f.name)} · ${money(f.price)}</button>`,
                )
                .join('')}
            </div>
          </div>
          <div class="config-group">
            <span class="eyebrow eyebrow--stone">${t('looks.config.vase')}</span>
            <div class="chips" data-vase-chips>
              ${vases
                .map(
                  (v) => `<button class="chip" data-vase="${v.id}" aria-pressed="${v.id === vaseId}">
                    ${esc(v.name)} · ${money(v.price)}</button>`,
                )
                .join('')}
            </div>
          </div>
          <div class="config-price" data-config-price aria-live="polite"></div>
          <button class="btn btn--primary" data-add-custom style="align-self:flex-start">${t('looks.config.add')}
            <svg class="btn-arrow" width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M0 5h14M10 1l4 4-4 4" stroke="currentColor"/></svg>
          </button>
        </div>
      </div>
    </div>
  </section>

  ${trustStripMarkup()}
  ${recentStripMarkup()}`;

  const preview = qs<HTMLElement>(main, '[data-config-preview]');
  const priceBox = qs<HTMLElement>(main, '[data-config-price]');

  function paint(): void {
    const flower = productById(flowerId)!;
    const vase = productById(vaseId)!;
    const separate = flower.price + vase.price;
    const bundled = bundlePrice(separate);
    preview.innerHTML = pairArt(flowerId, vaseId, flower.colors?.[0]?.hex);
    priceBox.innerHTML = `
      <span class="sep">${t('looks.config.separate')}<s>${money(separate)}</s></span>
      <span class="bundle">${t('looks.config.bundle')} ${money(bundled)}
        <span class="save">${tt('looks.save', { amount: money(separate - bundled) })}</span></span>`;
  }

  main.querySelectorAll<HTMLButtonElement>('[data-flower]').forEach((chip) =>
    chip.addEventListener('click', () => {
      flowerId = chip.dataset.flower!;
      main.querySelectorAll('[data-flower]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      paint();
    }),
  );
  main.querySelectorAll<HTMLButtonElement>('[data-vase]').forEach((chip) =>
    chip.addEventListener('click', () => {
      vaseId = chip.dataset.vase!;
      main.querySelectorAll('[data-vase]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      paint();
    }),
  );

  main.querySelectorAll<HTMLButtonElement>('[data-add-look]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const look = looks.find((l) => l.id === btn.dataset.addLook)!;
      addLook(look.id);
      showToast(tt('toast.added', { name: tp(look, 'name') }));
    }),
  );

  qs<HTMLElement>(main, '[data-add-custom]').addEventListener('click', () => {
    addCustomBundle(flowerId, vaseId);
    showToast(tt('toast.added', { name: t('looks.custom') }));
  });

  paint();
}
