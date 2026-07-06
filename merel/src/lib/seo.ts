/**
 * Per-route SEO: document title, meta description and JSON-LD structured
 * data (Organization + WebSite always; Product / FAQPage / BreadcrumbList
 * per view). All figures come from real store data.
 */
import type { Route } from '../router';
import { t, tp, getLocale } from '../i18n';
import { productById } from '../data/products';
import { ratingFor } from '../data/reviews';

const ORIGIN = 'https://merel.nl'; // placeholder domain — replace at launch

function baseLd(): object[] {
  return [
    {
      '@type': 'Organization',
      name: 'Merèl',
      url: ORIGIN,
      logo: `${ORIGIN}/favicon.svg`,
      email: 'studio@merel.nl',
      address: { '@type': 'PostalAddress', addressLocality: 'Amsterdam', addressCountry: 'NL' },
    },
    {
      '@type': 'WebSite',
      name: 'Merèl',
      url: ORIGIN,
      inLanguage: getLocale() === 'nl' ? 'nl-NL' : 'en-GB',
    },
  ];
}

function productLd(id: string): object[] {
  const p = productById(id);
  if (!p) return [];
  const rating = ratingFor(p.id);
  return [
    {
      '@type': 'Product',
      name: `${p.name} — ${tp(p, 'kind')}`,
      description: tp(p, 'blurb'),
      sku: p.id,
      brand: { '@type': 'Brand', name: 'Merèl' },
      offers: {
        '@type': 'Offer',
        price: p.price,
        priceCurrency: 'EUR',
        availability:
          p.stock === undefined || p.stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        url: `${ORIGIN}/product/${p.id}`,
      },
      ...(rating.count
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: rating.average,
              reviewCount: rating.count,
            },
          }
        : {}),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('pdp.home'), item: ORIGIN },
        { '@type': 'ListItem', position: 2, name: t('pdp.shop'), item: `${ORIGIN}/shop` },
        { '@type': 'ListItem', position: 3, name: p.name },
      ],
    },
  ];
}

function faqLd(): object[] {
  return [
    {
      '@type': 'FAQPage',
      mainEntity: [1, 2, 3, 4, 5, 6, 7].map((i) => ({
        '@type': 'Question',
        name: t(`care.q${i}` as 'care.q1'),
        acceptedAnswer: { '@type': 'Answer', text: t(`care.a${i}` as 'care.a1') },
      })),
    },
  ];
}

export function applySeo(route: Route): void {
  let title = 'Merèl — Everlasting Botanicals';
  let description = t('seo.home');
  let extraLd: object[] = [];

  switch (route.name) {
    case 'shop':
      title = `${t('shop.title')} — Merèl`;
      description = t('seo.shop');
      break;
    case 'looks':
      title = `${t('looks.title')} — Merèl`;
      description = t('seo.looks');
      break;
    case 'story':
      title = `${t('story.title')} — Merèl`;
      description = t('seo.story');
      break;
    case 'care':
      title = `${t('care.title')} — Merèl`;
      description = t('seo.care');
      extraLd = faqLd();
      break;
    case 'wishlist':
      title = `${t('wishlist.title')} — Merèl`;
      break;
    case 'notfound':
      title = `${t('nf.title')} — Merèl`;
      break;
    case 'product': {
      const p = productById(route.id);
      if (p) {
        title = `${p.name} — ${tp(p, 'kind')} — Merèl`;
        description = tp(p, 'blurb');
        extraLd = productLd(route.id);
      }
      break;
    }
  }

  document.title = title;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', description);
  document
    .querySelector('meta[property="og:title"]')
    ?.setAttribute('content', title);
  document
    .querySelector('meta[property="og:description"]')
    ?.setAttribute('content', description);

  let script = document.getElementById('jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [...baseLd(), ...extraLd],
  });
}
