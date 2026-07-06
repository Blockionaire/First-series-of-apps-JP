import { t } from '../i18n';
import { motifSprout } from '../components/art';

export function renderNotFound(main: HTMLElement): void {
  main.innerHTML = `
  <section class="container section" style="text-align:center;padding-block:clamp(4rem,12vw,8rem)">
    <div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem">
      ${motifSprout(52)}
      <h1>${t('nf.title')}</h1>
      <p class="lede" style="text-align:center">${t('nf.body')}</p>
      <a class="btn btn--primary" href="/shop">${t('nf.cta')}
        <svg class="btn-arrow" width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M0 5h14M10 1l4 4-4 4" stroke="currentColor"/></svg></a>
    </div>
  </section>`;
}
