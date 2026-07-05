/**
 * Scroll choreography. Everything slow and small — luxury restraint.
 * Full prefers-reduced-motion support: we simply never animate, so all
 * elements sit in their final state.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reducedMotion } from '../lib/dom';

gsap.registerPlugin(ScrollTrigger);

let triggers: ScrollTrigger[] = [];

function collect(animation: gsap.core.Tween | gsap.core.Timeline): void {
  const st = animation.scrollTrigger as ScrollTrigger | undefined;
  if (st) triggers.push(st);
}

function prepareBloom(svg: SVGElement): number {
  let max = 0;
  svg.querySelectorAll<SVGGeometryElement>('.bloom-path').forEach((path) => {
    const len = path.getTotalLength();
    max = Math.max(max, len);
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
  });
  return max;
}

export function initPageMotion(root: HTMLElement): void {
  if (reducedMotion()) return;

  // Hero / editorial content fades and rises with slight stagger.
  root.querySelectorAll<HTMLElement>('[data-rise]').forEach((section) => {
    const children = Array.from(section.children) as HTMLElement[];
    collect(
      gsap.from(children.length ? children : section, {
        opacity: 0,
        y: 26,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: section, start: 'top 88%' },
      }),
    );
  });

  // Grid items stagger in, ~90ms steps.
  root.querySelectorAll<HTMLElement>('[data-grid-stagger]').forEach((grid) => {
    collect(
      gsap.from(grid.children, {
        opacity: 0,
        y: 22,
        duration: 0.9,
        ease: 'power2.out',
        stagger: 0.09,
        scrollTrigger: { trigger: grid, start: 'top 86%' },
      }),
    );
  });

  // The interlude bloom self-draws when scrolled into view.
  root.querySelectorAll<HTMLElement>('[data-bloom-draw]').forEach((holder) => {
    const svg = holder.querySelector<SVGElement>('svg');
    if (!svg) return;
    prepareBloom(svg);
    collect(
      gsap.to(svg.querySelectorAll('.bloom-path'), {
        strokeDashoffset: 0,
        duration: 2.4,
        ease: 'power1.inOut',
        stagger: 0.18,
        scrollTrigger: { trigger: holder, start: 'top 78%' },
      }),
    );
  });

  // Story bloom draws scrubbed to scroll progress — reversible.
  root.querySelectorAll<HTMLElement>('[data-bloom-scrub]').forEach((holder) => {
    const svg = holder.querySelector<SVGElement>('svg');
    if (!svg) return;
    prepareBloom(svg);
    collect(
      gsap.to(svg.querySelectorAll('.bloom-path'), {
        strokeDashoffset: 0,
        ease: 'none',
        stagger: 0.12,
        scrollTrigger: {
          trigger: holder,
          start: 'top 85%',
          end: 'bottom 35%',
          scrub: 0.6,
        },
      }),
    );
  });

  // Subtle parallax (≤8%) on editorial imagery.
  root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    collect(
      gsap.fromTo(
        el,
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
        },
      ),
    );
  });
}

export function killPageMotion(): void {
  triggers.forEach((st) => st.kill());
  triggers = [];
}
