import { t, tt } from '../i18n';
import { esc } from '../lib/dom';
import { PROMO } from '../data/config';
import { isSubscribed, setSubscribed, promoShown, markPromoShown } from '../state/prefs';
import { registerOverlay, unregisterOverlay } from './overlay';
import { showToast } from './toast';

interface ModalHandle {
  close: () => void;
  card: HTMLElement;
}

export function openModal(innerHtml: string, opts: { onClose?: () => void; wide?: boolean } = {}): ModalHandle {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-card ${opts.wide ? 'quickview-card' : ''}" role="dialog" aria-modal="true">
    <button class="modal-close" data-modal-close>${t('nav.close')}</button>
    ${innerHtml}
  </div>`;
  document.body.append(overlay, modal);

  const card = modal.querySelector<HTMLElement>('.modal-card')!;
  const close = () => {
    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');
    unregisterOverlay(card);
    window.setTimeout(() => {
      overlay.remove();
      modal.remove();
    }, 500);
    opts.onClose?.();
  };

  overlay.addEventListener('click', close);
  modal.querySelector('[data-modal-close]')?.addEventListener('click', close);
  registerOverlay(card, close);

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    modal.classList.add('is-open');
    modal.querySelector<HTMLElement>('.modal-close')?.focus();
  });

  return { close, card };
}

/** Checkout: explains the hosted Shopify/Stripe handoff — never builds payments. */
export function openCheckoutModal(): void {
  const { close, card } = openModal(`
    <div class="modal-pad">
      <span class="eyebrow">Merèl</span>
      <h2>${t('checkout.title')}</h2>
      <p style="color:var(--cocoa)">${t('checkout.body')}</p>
      <button class="btn btn--primary" data-ok>${t('checkout.ok')}</button>
    </div>`);
  card.querySelector('[data-ok]')?.addEventListener('click', close);
}

/**
 * One-time promo modal: ~4.2s after first open, never again (persisted),
 * never on exit-intent, skipped when already subscribed.
 */
export function schedulePromoModal(): void {
  if (promoShown() || isSubscribed()) return;
  window.setTimeout(() => {
    if (promoShown() || isSubscribed()) return;
    markPromoShown();
    const { close, card } = openModal(`
      <div class="modal-pad" style="text-align:center;align-items:center">
        <span class="eyebrow">${t('promo.eyebrow')}</span>
        <h2>${t('promo.title')}</h2>
        <p style="color:var(--cocoa);max-width:30em">${t('promo.body')}</p>
        <form class="email-form" data-promo-form novalidate style="justify-content:center">
          <input class="field" type="email" required autocomplete="email"
            placeholder="${esc(t('email.placeholder'))}" aria-label="${esc(t('email.placeholder'))}" />
          <button class="btn btn--primary" type="submit">${t('email.cta')}</button>
        </form>
        <p class="email-consent">${t('email.consent')}</p>
        <button class="link-underline" data-later style="font-size:.75rem;color:var(--stone)">${t('promo.dismiss')}</button>
      </div>`);
    card.querySelector('[data-later]')?.addEventListener('click', close);
    card.querySelector<HTMLFormElement>('[data-promo-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = card.querySelector<HTMLInputElement>('input[type=email]')!;
      if (!input.value || !input.checkValidity()) {
        input.focus();
        return;
      }
      setSubscribed();
      showToast(t('toast.subscribed'));
      const pad = card.querySelector<HTMLElement>('.modal-pad');
      if (pad) {
        pad.innerHTML = `
          <span class="eyebrow">${t('promo.eyebrow')}</span>
          <p class="lede" style="text-align:center">
            ${tt('email.successCode', { code: `<b class="promo-code">${PROMO.code}</b>` })}</p>
          <button class="btn btn--primary" data-promo-done>${t('checkout.ok')}</button>`;
        pad.querySelector('[data-promo-done]')?.addEventListener('click', close);
      }
    });
  }, 4200);
}
