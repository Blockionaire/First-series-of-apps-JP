import { t, tt } from '../i18n';

export function renderCare(main: HTMLElement): void {
  const faqs = [1, 2, 3, 4, 5, 6, 7] as const;
  main.innerHTML = `
  <section class="container section care-page" style="padding-top:clamp(2rem,5vw,3.5rem)">
    <div class="section-head">
      <span class="eyebrow">Merèl</span>
      <h1 style="font-size:clamp(2.2rem,5vw,3.4rem)">${t('care.title')}</h1>
      <p class="lede">${t('care.sub')}</p>
    </div>
    <div>
      ${faqs
        .map(
          (i) => `<details class="accordion">
            <summary>${t(`care.q${i}` as 'care.q1')}</summary>
            <div class="accordion-body">${t(`care.a${i}` as 'care.a1')}</div>
          </details>`,
        )
        .join('')}
    </div>
    <p class="contact-line">${tt('care.contact', {
      email: '<a href="mailto:studio@merel.nl">studio@merel.nl</a>',
    })}</p>
  </section>`;
}
