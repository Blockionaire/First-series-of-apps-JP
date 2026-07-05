/** Shared page sections: trust strip, email capture, recently viewed. */
import { t, tt } from '../i18n';
import { esc } from '../lib/dom';
import { money } from '../lib/format';
import { productById, colorOf } from '../data/products';
import { getRecent } from '../state/prefs';
import { isSubscribed, setSubscribed } from '../state/prefs';
import { showToast } from './toast';
import { productArt } from './art';

const ICONS = [
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.3"><path d="M2 7h13v10H2zM15 10h4l3 3v4h-7zM6.5 19.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.3"><path d="M4 9V6a2 2 0 012-2h12a2 2 0 012 2v3M4 9l8 5 8-5M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.3"><path d="M12 21C7 16 4 12.5 4 9a5 5 0 018-4 5 5 0 018 4c0 3.5-3 7-8 12z"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.3"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
];

export function trustStripMarkup(): string {
  return `<div class="container section" style="padding-block:0">
    <ul class="trust-strip" style="list-style:none">
      ${[1, 2, 3, 4]
        .map(
          (i) => `<li class="trust-item">${ICONS[i - 1]}
            <b>${t(`trust.${i}.title` as 'trust.1.title')}</b>
            <span>${t(`trust.${i}.sub` as 'trust.1.sub')}</span></li>`,
        )
        .join('')}
    </ul>
  </div>`;
}

export function emailCaptureMarkup(): string {
  if (isSubscribed()) return '';
  return `<section class="container section" style="padding-top:0">
    <div class="email-capture" data-email-capture>
      <span class="eyebrow">${t('email.eyebrow')}</span>
      <h2>${t('email.title')}</h2>
      <p class="lede" style="margin-inline:auto">${t('email.body')}</p>
      <form class="email-form" data-email-form novalidate>
        <input class="field" type="email" required autocomplete="email"
          placeholder="${esc(t('email.placeholder'))}" aria-label="${esc(t('email.placeholder'))}" />
        <button class="btn btn--primary" type="submit">${t('email.cta')}</button>
      </form>
      <p class="email-consent">${t('email.consent')}</p>
    </div>
  </section>`;
}

export function bindEmailCapture(root: HTMLElement): void {
  root.querySelectorAll<HTMLFormElement>('[data-email-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector<HTMLInputElement>('input[type=email]')!;
      if (!input.value || !input.checkValidity()) {
        input.focus();
        return;
      }
      setSubscribed();
      const box = form.closest<HTMLElement>('[data-email-capture]');
      if (box) {
        box.innerHTML = `<p class="lede" style="margin-inline:auto">${t('email.success')}</p>`;
      }
      showToast(t('toast.subscribed'));
    });
  });
}

/** "Seen earlier" strip; hidden until ≥2 entries besides the current product. */
export function recentStripMarkup(excludeId?: string): string {
  const entries = getRecent().filter((e) => e.productId !== excludeId);
  if (entries.length < 2) return '';
  return `<section class="recent-strip">
    <div class="container">
      <div class="section-head" style="margin-bottom:1.4rem">
        <span class="eyebrow eyebrow--stone">${t('recent.title')}</span>
      </div>
      <div class="recent-row">
        ${entries
          .map((e) => {
            const p = productById(e.productId);
            if (!p) return '';
            const color = colorOf(p, e.colorId);
            return `<a class="recent-tile" href="/product/${p.id}">
              <span class="thumb">${productArt(p, { colorHex: color?.hex })}</span>
              <span class="name">${esc(p.name)}</span>
              <span class="price">${money(p.price)}</span>
            </a>`;
          })
          .join('')}
      </div>
    </div>
  </section>`;
}

export { tt };
