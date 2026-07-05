import { emit } from './lib/bus';

export type Route =
  | { name: 'home' }
  | { name: 'shop' }
  | { name: 'product'; id: string }
  | { name: 'looks' }
  | { name: 'story' }
  | { name: 'care' };

export function parse(path: string): Route {
  const clean = path.replace(/\/+$/, '') || '/';
  if (clean === '/') return { name: 'home' };
  if (clean === '/shop') return { name: 'shop' };
  if (clean === '/looks') return { name: 'looks' };
  if (clean === '/story') return { name: 'story' };
  if (clean === '/care') return { name: 'care' };
  const product = clean.match(/^\/product\/([\w-]+)$/);
  if (product) return { name: 'product', id: product[1] };
  return { name: 'home' };
}

let current: Route = parse(window.location.pathname);

export function currentRoute(): Route {
  return current;
}

export function pathFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'product':
      return `/product/${route.id}`;
    default:
      return `/${route.name}`;
  }
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const next = parse(path);
  if (opts.replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  current = next;
  emit('route:change');
}

export function initRouter(): void {
  window.addEventListener('popstate', () => {
    current = parse(window.location.pathname);
    emit('route:change');
  });

  // Global interception of internal links.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/"]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('data-external')) return;
    e.preventDefault();
    if (anchor.pathname !== window.location.pathname) navigate(anchor.pathname);
  });
}
