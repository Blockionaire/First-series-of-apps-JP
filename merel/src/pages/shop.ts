import { t, tt } from '../i18n';
import { esc, qs } from '../lib/dom';
import { products, productById, type Category } from '../data/products';
import { ratingFor } from '../data/reviews';
import { productCardMarkup, bindProductCards } from '../components/productCard';
import { trustStripMarkup, emailCaptureMarkup, bindEmailCapture, recentStripMarkup } from '../components/sections';

type Sort = 'featured' | 'priceAsc' | 'priceDesc' | 'rating';
type Tab = 'all' | Category;

// Toolbar state survives in-page re-filters but resets per visit.
let tab: Tab = 'all';
let sort: Sort = 'featured';
let query = '';

const TABS: Tab[] = ['all', 'bouquets', 'stems', 'vases'];
const SORTS: Sort[] = ['featured', 'priceAsc', 'priceDesc', 'rating'];

function filtered() {
  let list = products.filter((p) => tab === 'all' || p.category === tab);
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter((p) =>
      [p.name, p.kind, p.kind_nl, p.blurb, p.blurb_nl].join(' ').toLowerCase().includes(q),
    );
  }
  switch (sort) {
    case 'priceAsc':
      list = [...list].sort((a, b) => a.price - b.price);
      break;
    case 'priceDesc':
      list = [...list].sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      list = [...list].sort((a, b) => ratingFor(b.id).average - ratingFor(a.id).average);
      break;
    default:
      list = [...list].sort((a, b) => Number(b.signature ?? false) - Number(a.signature ?? false));
  }
  return list;
}

export function renderShop(main: HTMLElement): void {
  tab = 'all';
  sort = 'featured';
  query = '';

  main.innerHTML = `
  <section class="container section" style="padding-top:clamp(2rem,5vw,3.5rem)">
    <div class="section-head">
      <span class="eyebrow">Merèl</span>
      <h1 style="font-size:clamp(2.2rem,5vw,3.4rem)">${t('shop.title')}</h1>
      <p class="lede">${t('shop.sub')}</p>
    </div>
    <div class="shop-toolbar">
      <div class="tabs" role="group" aria-label="Category">
        ${TABS.map(
          (tb) =>
            `<button class="tab" data-tab="${tb}" aria-pressed="${tb === tab}">${t(`shop.tab.${tb}` as 'shop.tab.all')}</button>`,
        ).join('')}
      </div>
      <input class="field shop-search" type="search" data-search
        placeholder="${esc(t('shop.search'))}" aria-label="${esc(t('shop.search'))}" />
      <select class="shop-sort" data-sort aria-label="Sort">
        ${SORTS.map((s) => `<option value="${s}">${t(`shop.sort.${s}` as 'shop.sort.featured')}</option>`).join('')}
      </select>
    </div>
    <p class="shop-count" data-count aria-live="polite"></p>
    <div class="product-grid" data-grid data-grid-stagger style="margin-top:1.2rem"></div>
  </section>
  ${trustStripMarkup()}
  <div style="height:clamp(2.5rem,6vw,4.5rem)"></div>
  ${emailCaptureMarkup()}
  ${recentStripMarkup()}`;

  const grid = qs<HTMLElement>(main, '[data-grid]');
  const count = qs<HTMLElement>(main, '[data-count]');

  function paint(): void {
    const list = filtered();
    count.textContent =
      list.length === 1 ? t('shop.count.one') : tt('shop.count.many', { n: list.length });
    grid.innerHTML = list.length
      ? list.map((p) => productCardMarkup(p)).join('')
      : `<p class="shop-empty" style="grid-column:1/-1">${t('shop.empty')}</p>`;
    bindProductCards(grid, productById);
  }

  main.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) =>
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab as Tab;
      main.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      paint();
    }),
  );

  qs<HTMLInputElement>(main, '[data-search]').addEventListener('input', (e) => {
    query = (e.target as HTMLInputElement).value;
    paint();
  });

  qs<HTMLSelectElement>(main, '[data-sort]').addEventListener('change', (e) => {
    sort = (e.target as HTMLSelectElement).value as Sort;
    paint();
  });

  paint();
  bindEmailCapture(main);
}
