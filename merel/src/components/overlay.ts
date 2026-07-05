import { trapFocus } from '../lib/dom';

/**
 * Shared overlay stack: Escape closes the top-most overlay, focus is
 * trapped inside, and focus returns to the opener on close.
 */
interface Entry {
  el: HTMLElement;
  close: () => void;
  untrap: () => void;
  opener: HTMLElement | null;
}

const stack: Entry[] = [];

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].close();
  }
});

export function registerOverlay(el: HTMLElement, close: () => void): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  stack.push({ el, close, untrap: trapFocus(el), opener });
}

export function unregisterOverlay(el: HTMLElement): void {
  const index = stack.findIndex((entry) => entry.el === el);
  if (index === -1) return;
  const [entry] = stack.splice(index, 1);
  entry.untrap();
  entry.opener?.focus();
}
