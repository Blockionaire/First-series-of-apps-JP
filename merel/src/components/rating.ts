import { ratingFor } from '../data/reviews';

const STAR = (fill: number) => {
  const id = `s${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="${id}"><stop offset="${fill * 100}%" stop-color="currentColor"/><stop offset="${fill * 100}%" stop-color="transparent"/></linearGradient></defs>
    <path fill="url(#${id})" stroke="currentColor" stroke-width="1.2"
      d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.5l5.8-.8z"/>
  </svg>`;
};

export function starsMarkup(average: number): string {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += STAR(Math.max(0, Math.min(1, average - (i - 1))));
  }
  return `<span class="stars" role="img" aria-label="${average} / 5">${out}</span>`;
}

export function ratingLine(productId: string): string {
  const { count, average } = ratingFor(productId);
  if (!count) return '';
  return `<span class="rating-line">${starsMarkup(average)}<span>${average} (${count})</span></span>`;
}
