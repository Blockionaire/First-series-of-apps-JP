import { t, tt, tp } from '../i18n';
import { productById } from '../data/products';
import { inWishlist, toggleWishlist } from '../state/prefs';
import { showToast } from './toast';

const HEART = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
  <path class="heart-path" d="M12 20.2C7 15.4 3.6 12 3.6 8.6a4.6 4.6 0 018.4-2.6 4.6 4.6 0 018.4 2.6c0 3.4-3.4 6.8-8.4 11.6z"
    fill="none" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

export function wishButtonMarkup(productId: string, cls = ''): string {
  const saved = inWishlist(productId);
  return `<button type="button" class="wish-btn ${cls}" data-wish="${productId}"
    aria-pressed="${saved}" aria-label="${saved ? t('wishlist.saved') : t('wishlist.save')}"
    title="${saved ? t('wishlist.saved') : t('wishlist.save')}">${HEART}</button>`;
}

/** Wires hearts inside `root`; never navigates the underlying card. */
export function bindWishButtons(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>('[data-wish]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.wish!;
      const saved = toggleWishlist(id);
      // Sync every heart for this product currently on the page.
      document.querySelectorAll<HTMLButtonElement>(`[data-wish="${id}"]`).forEach((other) => {
        other.setAttribute('aria-pressed', String(saved));
        other.setAttribute('aria-label', saved ? t('wishlist.saved') : t('wishlist.save'));
      });
      const p = productById(id);
      if (p) showToast(tt(saved ? 'toast.wishAdded' : 'toast.wishRemoved', { name: tp(p, 'name') }));
    });
  });
}
