import { t } from '../i18n';
import { registerOverlay, unregisterOverlay } from './overlay';

/** PDP media lightbox with click-to-zoom. */
export function openLightbox(artHtml: string): void {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `
    <button class="lightbox-close">${t('nav.close')}</button>
    <div class="stage" role="img">${artHtml}</div>
    <span class="lightbox-hint">${t('pdp.lightboxHint')}</span>`;
  document.body.appendChild(el);

  const stage = el.querySelector<HTMLElement>('.stage')!;
  const close = () => {
    el.classList.remove('is-open');
    unregisterOverlay(el);
    window.setTimeout(() => el.remove(), 400);
  };

  stage.addEventListener('click', () => stage.classList.toggle('is-zoomed'));
  el.querySelector('.lightbox-close')?.addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });

  registerOverlay(el, close);
  requestAnimationFrame(() => {
    el.classList.add('is-open');
    el.querySelector<HTMLElement>('.lightbox-close')?.focus();
  });
}
