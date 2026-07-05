import type { Product } from '../data/products';
import { tp } from '../i18n';
import { esc } from '../lib/dom';

/**
 * Colour swatch row. Retints in place — never navigates. The visible dot
 * is 18–24px; the touch target around it is ~38px.
 */
export function swatchesMarkup(p: Product, activeColorId: string | undefined, large = false): string {
  if (!p.colors) return '';
  const active = activeColorId ?? p.colors[0].id;
  return `<span class="swatches ${large ? 'swatches--lg' : ''}" role="group" aria-label="Colour">
    ${p.colors
      .map(
        (c) => `<button type="button" class="swatch" data-swatch="${c.id}"
          aria-pressed="${c.id === active}" aria-label="${esc(tp(c, 'name'))}"
          title="${esc(tp(c, 'name'))}"><i style="background:${c.hex}"></i></button>`,
      )
      .join('')}
  </span>`;
}

/** Wire swatch clicks inside `root`; stops propagation so cards don't navigate. */
export function bindSwatches(root: HTMLElement, onPick: (colorId: string) => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-swatch]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      root.querySelectorAll('[data-swatch]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      onPick(btn.dataset.swatch!);
    });
  });
}
