import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

import { initRouter, currentRoute } from './router';
import { initLocale, t } from './i18n';
import { on } from './lib/bus';
import { renderAnnouncement } from './components/announcement';
import { renderHeader, updateCartCount } from './components/header';
import { renderFooter } from './components/footer';
import { renderCartDrawer, cartDrawerIsOpen } from './components/cartDrawer';
import { schedulePromoModal } from './components/modals';
import { renderHome } from './pages/home';
import { renderShop } from './pages/shop';
import { renderProduct } from './pages/product';
import { renderLooks } from './pages/looks';
import { renderStory } from './pages/story';
import { renderCare } from './pages/care';
import { initPageMotion, killPageMotion } from './motion/scroll';
import { reducedMotion } from './lib/dom';

const app = document.getElementById('app')!;
app.innerHTML = `
  <a class="skip-link" href="#main">${t('skip.content')}</a>
  <div id="announce-host"></div>
  <div id="header-host"></div>
  <main id="main" tabindex="-1"></main>
  <div id="footer-host"></div>`;

const announceHost = document.getElementById('announce-host')!;
const headerHost = document.getElementById('header-host')!;
const main = document.getElementById('main')!;
const footerHost = document.getElementById('footer-host')!;

let pageCleanup: (() => void) | null = null;

function renderPage(): void {
  pageCleanup?.();
  pageCleanup = null;
  killPageMotion();

  const route = currentRoute();
  let cleanup: (() => void) | void;
  switch (route.name) {
    case 'shop':
      cleanup = renderShop(main);
      break;
    case 'product':
      cleanup = renderProduct(main, route.id);
      break;
    case 'looks':
      cleanup = renderLooks(main);
      break;
    case 'story':
      cleanup = renderStory(main);
      break;
    case 'care':
      cleanup = renderCare(main);
      break;
    default:
      cleanup = renderHome(main);
  }
  if (typeof cleanup === 'function') pageCleanup = cleanup;

  window.scrollTo({ top: 0, behavior: 'auto' });
  initPageMotion(main);
}

function renderChrome(): void {
  renderAnnouncement(announceHost);
  renderHeader(headerHost);
  renderFooter(footerHost);
}

/* — Boot ------------------------------------------------------------------ */
initLocale();
initRouter();

// Custom cursor only on desktop pointer devices.
if (window.matchMedia('(pointer: fine)').matches) {
  document.body.classList.add('custom-cursor');
}

renderChrome();
renderPage();
schedulePromoModal();

on('route:change', () => {
  renderChrome(); // active nav state
  renderPage();
});

on('lang:change', () => {
  renderChrome();
  renderPage();
  if (cartDrawerIsOpen()) renderCartDrawer();
});

on('cart:change', () => {
  updateCartCount();
  if (cartDrawerIsOpen()) renderCartDrawer();
});

// Reduced-motion listeners can change live; re-render motion cheaply.
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => {
  killPageMotion();
  if (!reducedMotion()) initPageMotion(main);
});
