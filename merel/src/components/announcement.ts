import { t } from '../i18n';
import { esc, reducedMotion } from '../lib/dom';

const ROTATE_MS = 4500;
let timer: number | undefined;

export function renderAnnouncement(host: HTMLElement): void {
  const messages = [t('announce.1'), t('announce.2'), t('announce.3')];
  host.innerHTML = `<div class="announce" role="status" aria-live="polite">
    ${messages.map((m, i) => `<span class="${i === 0 ? 'is-active' : ''}">${esc(m)}</span>`).join('')}
  </div>`;

  window.clearInterval(timer);
  if (reducedMotion()) return;

  const spans = Array.from(host.querySelectorAll('span'));
  let index = 0;
  timer = window.setInterval(() => {
    spans[index].classList.remove('is-active');
    index = (index + 1) % spans.length;
    spans[index].classList.add('is-active');
  }, ROTATE_MS);
}
