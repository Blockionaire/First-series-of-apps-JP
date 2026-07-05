import { t } from '../i18n';
import { motifBloom } from '../components/art';

export function renderStory(main: HTMLElement): void {
  main.innerHTML = `
  <section class="story-hero container" data-rise>
    <span class="eyebrow">${t('story.eyebrow')}</span>
    <h1>${t('story.title')}</h1>
  </section>
  <div class="story-body container">
    <p>${t('story.p1')}</p>
    <p>${t('story.p2')}</p>
  </div>
  <div class="story-bloom-wrap">
    <div data-bloom-scrub>${motifBloom('bloom')}</div>
  </div>
  <div class="story-body container">
    <p>${t('story.p3')}</p>
    <p class="serif" style="font-style:italic;font-size:1.25rem;color:var(--espresso)">${t('story.p4')}</p>
    <p class="eyebrow eyebrow--stone" style="margin-top:1rem">— ${t('story.sign')}</p>
  </div>`;
}
