/** Small commerce micro-interactions: button confirmation, count pulse. */
import { t } from '../i18n';

/** Morph a CTA into a sage "✓ Added" state for a moment, then restore. */
export function confirmAdded(btn: HTMLElement): void {
  if (btn.dataset.confirming) return;
  btn.dataset.confirming = '1';
  const original = btn.innerHTML;
  btn.classList.add('is-added');
  btn.innerHTML = `<svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
      <path d="M1 5.5 L5 9.5 L13 1.5" stroke="currentColor" stroke-width="1.6"/>
    </svg> ${t('pdp.added')}`;
  window.setTimeout(() => {
    btn.classList.remove('is-added');
    btn.innerHTML = original;
    delete btn.dataset.confirming;
  }, 1500);
}

/** One gentle pulse on the header cart / wishlist counters. */
export function pulse(el: HTMLElement): void {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}
