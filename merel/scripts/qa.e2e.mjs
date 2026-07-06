import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const SHOT = process.env.SHOT_DIR ?? '/tmp/shots';
const results = [];
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  try { localStorage.setItem('merel:promo-shown', 'true'); } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

/* Home */
await page.goto(BASE + '/');
await page.waitForTimeout(1800);
check('home renders h1', (await page.textContent('h1'))?.includes('Flowers that look real'));
const ratingText = await page.textContent('.hero-rating');
check('hero rating derives from data', /4\.9 — from 34 verified reviews/.test(ratingText ?? ''), ratingText?.trim());
await page.screenshot({ path: `${SHOT}/01-home.png`, fullPage: false });

/* Announcement + header shadow */
check('announcement bar present', await page.locator('.announce span.is-active').count() === 1);
await page.evaluate(() => window.scrollTo(0, 200));
await page.waitForTimeout(500);
check('header shadow after scroll', await page.locator('.site-header.is-scrolled').count() === 1);

/* Shop */
await page.click('a[href="/shop"]', { position: { x: 5, y: 5 } }).catch(() => {});
await page.goto(BASE + '/shop');
await page.waitForTimeout(1200);
check('shop grid 8 products', (await page.locator('[data-grid] .product-card').count()) === 8);
check('piece count', (await page.textContent('[data-count]'))?.includes('8'));
// filter
await page.click('[data-tab="vases"]');
check('vases tab filters to 4', (await page.locator('[data-grid] .product-card').count()) === 4);
await page.click('[data-tab="all"]');
// search
await page.fill('[data-search]', 'orchid');
await page.waitForTimeout(200);
const searchCount = await page.locator('[data-grid] .product-card').count();
check('search "orchid" filters', searchCount === 2, `${searchCount} results`);
await page.fill('[data-search]', '');
// sort
await page.selectOption('[data-sort]', 'priceAsc');
const firstPrice = await page.locator('[data-grid] .card-price').first().textContent();
check('sort price asc puts €32 first', firstPrice?.includes('32'), firstPrice ?? '');
await page.screenshot({ path: `${SHOT}/02-shop.png` });

/* Swatch on card retints without navigating */
await page.selectOption('[data-sort]', 'featured');
const beforeUrl = page.url();
await page.locator('[data-card="orchid-arrangement"] [data-swatch="lilac"]').first().click();
check('card swatch does not navigate', page.url() === beforeUrl);

/* Quick view */
await page.hover('[data-card="orchid-arrangement"] .card-media');
await page.locator('[data-card="orchid-arrangement"] [data-quickview]').click();
await page.waitForTimeout(700);
check('quick view opens', await page.locator('.quickview-card').count() === 1);
check('quick view no navigation', page.url().endsWith('/shop'));
await page.locator('.quickview-card [data-qv-add]').click();
await page.waitForTimeout(700);
check('quick view add updates cart count', (await page.textContent('[data-cart-count]')) === '1');
await page.screenshot({ path: `${SHOT}/03-toast.png` });

/* PDP */
await page.goto(BASE + '/product/orchid-arrangement');
await page.waitForTimeout(1500);
check('pdp title', (await page.textContent('.pdp-title'))?.includes('Alba'));
check('pdp low stock (7 > 6 hidden)', (await page.locator('.low-stock').count()) === 0);
check('pdp countdown present', (await page.textContent('[data-countdown]'))?.length > 10, (await page.textContent('[data-countdown]'))?.trim());
check('pdp 6 media thumbs (3D + 5 gallery)', (await page.locator('[data-slot]').count()) === 6);
check('pdp 3d slot active (has model)', (await page.locator('[data-slot="3d"][aria-pressed="true"]').count()) === 1);
await page.waitForTimeout(2500);
check('3d canvas mounted', (await page.locator('.pdp-stage canvas').count()) === 1, errors.slice(-1).join(' '));
await page.screenshot({ path: `${SHOT}/04-pdp-3d.png` });
// colour change
await page.locator('.pdp-panel [data-swatch="blush"]').click();
check('colour label updates', (await page.textContent('[data-color-name]')) === 'Blush');
// gallery slot
await page.locator('[data-slot="compare"]').click();
await page.waitForTimeout(400);
check('compare slot renders', (await page.locator('.pdp-stage .art').count()) === 1);
await page.screenshot({ path: `${SHOT}/05-pdp-compare.png` });
// lightbox
await page.locator('.pdp-stage').click();
await page.waitForTimeout(500);
check('lightbox opens', (await page.locator('.lightbox.is-open').count()) === 1);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
check('escape closes lightbox', (await page.locator('.lightbox.is-open').count()) === 0);

/* Low stock on Sera (stock 4) */
await page.goto(BASE + '/product/calla-arrangement');
await page.waitForTimeout(800);
const low = await page.textContent('.low-stock');
check('low stock shows real number', low?.includes('4'), low ?? '');
check('sera has 5 thumbs (no model)', (await page.locator('[data-slot]').count()) === 5);

/* Add to cart, colour = separate lines */
await page.locator('.pdp-buy [data-add]').click();
await page.waitForTimeout(300);
await page.locator('.pdp-panel [data-swatch="plum"]').click();
await page.locator('.pdp-buy [data-add]').click();
await page.waitForTimeout(600);
await page.locator('[data-cart-open]').click();
await page.waitForTimeout(900);
const lineCount = await page.locator('.cart-line').count();
check('two colours = two lines (+1 from quickview)', lineCount === 3, `${lineCount} lines`);
await page.screenshot({ path: `${SHOT}/06-cart.png` });

/* Rewards + gift threshold: subtotal = 165 + 155*2 = 475 ≥ 175 → chooser */
check('gift chooser visible at ≥€175', (await page.locator('[data-gift-pick]').count()) === 3);
await page.locator('[data-gift-pick="vase-glass"]').click();
await page.waitForTimeout(600);
check('gift claim card', (await page.locator('[data-gift-change]').count()) === 1);
check('gift line €0 in summary', (await page.locator('.drawer-foot .free').count()) >= 1);
/* drop below threshold: remove lines */
await page.locator('.cart-line [data-remove]').first().click();
await page.waitForTimeout(400);
await page.locator('.cart-line [data-remove]').first().click();
await page.waitForTimeout(400);
await page.locator('.cart-line [data-remove]').first().click();
await page.waitForTimeout(400);
check('cart empty state', (await page.locator('.cart-empty').count()) === 1);

/* Rebuild: add Aria (38) → below 75; check rewards message */
await page.keyboard.press('Escape');
await page.goto(BASE + '/product/orchid-stem');
await page.waitForTimeout(700);
await page.locator('.pdp-buy [data-add]').click();
await page.locator('[data-cart-open]').click();
await page.waitForTimeout(800);
const msg1 = await page.textContent('.rewards-msg');
check('rewards asks €37 for shipping', msg1?.includes('37'), msg1?.trim());
check('gift silently revoked below €175', (await page.locator('[data-gift-change]').count()) === 0);

/* Gift wrap toggle preserves message */
await page.locator('[data-wrap]').check();
await page.waitForTimeout(500);
await page.fill('[data-wrap-msg]', 'Voor mama');
await page.locator('[data-wrap]').uncheck();
await page.waitForTimeout(400);
await page.locator('[data-wrap]').check();
await page.waitForTimeout(400);
check('wrap message preserved', (await page.inputValue('[data-wrap-msg]')) === 'Voor mama');

/* Upsell suggests paired vase (Velo for Aria) */
check('upsell suggests Velo', (await page.locator('[data-upsell-add="vase-glass"]').count()) === 1);

/* Checkout modal */
await page.locator('[data-checkout]').click();
await page.waitForTimeout(700);
check('checkout modal explains handoff', (await page.textContent('.modal-card'))?.includes('Shopify'));
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

/* Looks page + configurator */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.goto(BASE + '/looks');
await page.waitForTimeout(900);
const albaPrice = await page.locator('.look-card .card-price').first().textContent();
check('Alba look bundle = €235', albaPrice?.includes('235'), albaPrice ?? '');
await page.locator('[data-flower="calla-stem"]').click();
await page.locator('[data-vase="vase-glass"]').click();
const bundleTxt = await page.textContent('[data-config-price] .bundle');
check('configurator Luce+Velo = €80', bundleTxt?.includes('80'), bundleTxt?.trim());
await page.locator('[data-add-custom]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT}/07-looks.png` });

/* Language toggle: NL everywhere incl. cart */
await page.locator('[data-lang="nl"]').click();
await page.waitForTimeout(900);
check('html lang=nl', (await page.getAttribute('html', 'lang')) === 'nl');
check('nav in Dutch', (await page.textContent('.header-nav'))?.includes('Ons verhaal'));
await page.locator('[data-cart-open]').click();
await page.waitForTimeout(800);
check('cart title Dutch', (await page.textContent('.drawer-head h2')) === 'Je winkelmand');
check('custom bundle line Dutch', (await page.textContent('.drawer-body'))?.includes('Samengestelde look'));
await page.screenshot({ path: `${SHOT}/08-cart-nl.png` });
await page.keyboard.press('Escape');

/* NL countdown */
await page.goto(BASE + '/product/calla-stem');
await page.waitForTimeout(800);
const cdNl = await page.textContent('[data-countdown]');
check('countdown localized NL', /Bestel binnen/.test(cdNl ?? ''), cdNl?.trim());
await page.locator('[data-lang="en"]').click();
await page.waitForTimeout(600);

/* Story scrubbed bloom + care accordions */
await page.goto(BASE + '/story');
await page.waitForTimeout(700);
check('story bloom present', (await page.locator('[data-bloom-scrub] svg').count()) === 1);
await page.goto(BASE + '/care');
await page.waitForTimeout(700);
check('care 7 accordions', (await page.locator('.accordion').count()) === 7);
await page.screenshot({ path: `${SHOT}/09-care.png` });

/* Recently viewed strip (visited several products) */
await page.goto(BASE + '/shop');
await page.waitForTimeout(900);
check('recently viewed strip on shop', (await page.locator('.recent-strip .recent-tile').count()) >= 2);

/* Promo modal: fresh context should show once after ~4.2s */
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE + '/');
await p2.waitForTimeout(5600);
check('promo modal appears once', (await p2.locator('.modal-card').count()) === 1);
await p2.screenshot({ path: `${SHOT}/10-promo.png` });
await p2.keyboard.press('Escape');
await p2.waitForTimeout(600);
await p2.reload();
await p2.waitForTimeout(5600);
check('promo modal never again', (await p2.locator('.modal-card').count()) === 0);
await ctx2.close();

/* Mobile 375px layout */
const ctx3 = await browser.newContext({ viewport: { width: 375, height: 720 } });
const p3 = await ctx3.newPage();
await p3.goto(BASE + '/shop');
await p3.waitForTimeout(1000);
check('mobile burger visible', await p3.locator('.burger').isVisible());
check('quick view hidden <560px', !(await p3.locator('[data-quickview]').first().isVisible()));
await p3.screenshot({ path: `${SHOT}/11-mobile-shop.png` });
await p3.goto(BASE + '/product/calla-arrangement');
await p3.waitForTimeout(900);
await p3.evaluate(() => window.scrollTo(0, 3000));
await p3.waitForTimeout(800);
check('sticky mobile ATC appears', await p3.locator('[data-sticky-atc].is-visible').count() === 1);
await p3.screenshot({ path: `${SHOT}/12-mobile-pdp.png` });
await ctx3.close();

/* Reduced motion: bloom resolves instantly */
const ctx4 = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
const p4 = await ctx4.newPage();
const err4 = [];
p4.on('pageerror', (e) => err4.push(String(e)));
await p4.goto(BASE + '/');
await p4.waitForTimeout(1200);
const heroVisible = await p4.locator('.hero-copy h1').isVisible();
const heroOpacity = await p4.locator('.hero-copy').evaluate((el) => getComputedStyle(el.children[1]).opacity);
check('reduced motion: hero at final state', heroVisible && heroOpacity === '1', `opacity=${heroOpacity}`);
check('reduced motion: no js errors', err4.length === 0, err4.join('; '));
await ctx4.close();


/* — v2 upgrades ------------------------------------------------------- */

/* 404 for unknown routes and unknown products */
await page.goto(BASE + '/does-not-exist');
await page.waitForTimeout(700);
check('404 page for unknown route', (await page.textContent('h1'))?.includes('Nothing grows here'));
await page.goto(BASE + '/product/does-not-exist');
await page.waitForTimeout(700);
check('404 for unknown product', (await page.textContent('h1'))?.includes('Nothing grows here'));

/* JSON-LD structured data on PDP */
await page.goto(BASE + '/product/orchid-arrangement');
await page.waitForTimeout(900);
const ld = await page.evaluate(() => document.getElementById('jsonld')?.textContent ?? '');
check('PDP JSON-LD Product with rating', ld.includes('"Product"') && ld.includes('aggregateRating'));
check('PDP document title', (await page.title()).includes('Alba'));

/* Add-to-cart confirmation morph */
await page.locator('.pdp-buy [data-add]').click();
await page.waitForTimeout(300);
check('ATC morphs to added state', (await page.locator('.pdp-buy [data-add].is-added').count()) === 1);
await page.waitForTimeout(1600);

/* Qty cap by stock: Sera has stock 4 */
await page.goto(BASE + '/product/calla-arrangement');
await page.waitForTimeout(800);
for (let i = 0; i < 8; i++) await page.locator('.pdp-buy [data-qty="1"]').click();
check('PDP qty capped at stock 4', (await page.textContent('[data-qty-out]')) === '4');

/* Wishlist: heart on PDP, header count, wishlist page */
await page.locator('.wish-btn--pdp').click();
await page.waitForTimeout(500);
check('heart pressed on PDP', (await page.locator('.wish-btn--pdp[aria-pressed="true"]').count()) === 1);
check('header wishlist count', (await page.textContent('[data-wish-count]')) === '1');
await page.goto(BASE + '/wishlist');
await page.waitForTimeout(800);
check('wishlist page shows saved piece', (await page.locator('[data-wish-grid] .product-card').count()) === 1);
await page.locator('[data-wish-grid] .wish-btn').first().click({ force: true });
await page.waitForTimeout(600);
check('unheart empties wishlist live', (await page.locator('.cart-empty').count()) === 1);

/* Promo code loop: invalid rejected, MEREL10 applies 10% */
await page.locator('[data-cart-open]').click();
await page.waitForTimeout(800);
await page.locator('[data-promo-details] summary').click();
await page.fill('[data-promo-cart-form] input', 'WRONG');
await page.locator('[data-promo-cart-form] button').click();
await page.waitForTimeout(300);
check('invalid code shows error', await page.locator('[data-promo-error]:not([hidden])').count() === 1);
await page.fill('[data-promo-cart-form] input', 'merel10');
await page.locator('[data-promo-cart-form] button').click();
await page.waitForTimeout(600);
const summaryText = await page.textContent('.drawer-foot');
check('MEREL10 applies discount line', summaryText?.includes('MEREL10'), summaryText?.replace(/\s+/g,' ').slice(0,120));
await page.locator('[data-promo-remove]').click();
await page.waitForTimeout(500);
check('code removable', !(await page.textContent('.drawer-foot'))?.includes('MEREL10'));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

/* Card hover crossfade layer present */
await page.goto(BASE + '/shop');
await page.waitForTimeout(900);
check('cards carry room-scene hover layer', (await page.locator('[data-card-alt]').count()) === 8);

check('no page errors overall', errors.length === 0, errors.slice(0, 4).join(' | '));

await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
