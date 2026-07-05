import { getLocale, setLocale, t } from '../i18n';
import { qs, qsa } from '../lib/dom';
import { cartCount } from '../state/cart';
import { currentRoute, pathFor } from '../router';
import { openCartDrawer } from './cartDrawer';

const NAV: Array<{ path: string; key: 'nav.shop' | 'nav.looks' | 'nav.story' | 'nav.care' }> = [
  { path: '/shop', key: 'nav.shop' },
  { path: '/looks', key: 'nav.looks' },
  { path: '/story', key: 'nav.story' },
  { path: '/care', key: 'nav.care' },
];

let scrollBound = false;

export function renderHeader(host: HTMLElement): void {
  const route = currentRoute();
  const activePath = pathFor(route);
  const lang = getLocale();

  const navLinks = (cls: string) =>
    NAV.map(
      (n) =>
        `<a href="${n.path}" class="${cls}" ${activePath === n.path ? 'aria-current="page"' : ''}>${t(n.key)}</a>`,
    ).join('');

  host.innerHTML = `
    <header class="site-header" id="site-header">
      <div class="container header-inner">
        <div style="display:flex;align-items:center;gap:.6rem">
          <button class="burger" aria-label="${t('nav.menu')}" aria-expanded="false" data-burger>
            <i></i><i></i><i></i>
          </button>
          <nav class="header-nav" aria-label="Main">${navLinks('')}</nav>
        </div>
        <a href="/" class="brand" aria-label="Merèl — ${t('nav.home')}">Merèl</a>
        <div class="header-actions">
          <div class="lang-toggle" role="group" aria-label="Language">
            <button data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
            <span aria-hidden="true" style="color:var(--hairline-strong)">/</span>
            <button data-lang="nl" aria-pressed="${lang === 'nl'}">NL</button>
          </div>
          <button class="cart-btn" data-cart-open aria-label="${t('header.cart')}">
            <span class="cart-label">${t('header.cart')}</span>
            <span class="cart-count" data-cart-count>${cartCount()}</span>
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-nav" id="mobile-nav" aria-hidden="true">
      <button class="mobile-nav-close" data-nav-close>${t('nav.close')}</button>
      <a href="/">${t('nav.home')}</a>
      ${navLinks('')}
    </div>`;

  const header = qs<HTMLElement>(host, '#site-header');
  const mobileNav = qs<HTMLElement>(host, '#mobile-nav');
  const burger = qs<HTMLButtonElement>(host, '[data-burger]');

  const syncShadow = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  syncShadow();
  if (!scrollBound) {
    scrollBound = true;
    window.addEventListener('scroll', () => {
      document.getElementById('site-header')?.classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  const closeNav = () => {
    mobileNav.classList.remove('is-open');
    mobileNav.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('is-open');
    mobileNav.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    if (open) qs<HTMLElement>(mobileNav, 'a').focus();
  });
  qs<HTMLElement>(host, '[data-nav-close]').addEventListener('click', closeNav);
  qsa(mobileNav, 'a').forEach((a) => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) closeNav();
  });

  qsa<HTMLButtonElement>(host, '[data-lang]').forEach((btn) =>
    btn.addEventListener('click', () => setLocale(btn.dataset.lang as 'en' | 'nl')),
  );

  qs<HTMLButtonElement>(host, '[data-cart-open]').addEventListener('click', openCartDrawer);
}

export function updateCartCount(): void {
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = String(cartCount());
  });
}
