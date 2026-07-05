import { en, type MessageKey } from './en';
import { nl } from './nl';
import { storageGet, storageSet } from '../lib/storage';
import { emit } from '../lib/bus';

export type Locale = 'en' | 'nl';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, nl };

let locale: Locale = storageGet<Locale>('lang', 'en');

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  storageSet('lang', next);
  document.documentElement.lang = next;
  emit('lang:change');
}

/** Plain lookup. */
export function t(key: MessageKey): string {
  return dictionaries[locale][key] ?? en[key] ?? key;
}

/** Template lookup: tt('rewards.ship', { amount: '€12' }). */
export function tt(key: MessageKey, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

/**
 * Product/data field lookup: tp(product, 'name') returns `name_nl`
 * in Dutch when present, `name` otherwise.
 */
export function tp<T extends Record<string, unknown>>(obj: T, field: string): string {
  if (locale === 'nl') {
    const localized = obj[`${field}_nl`];
    if (typeof localized === 'string') return localized;
  }
  const base = obj[field];
  return typeof base === 'string' ? base : '';
}

export function initLocale(): void {
  document.documentElement.lang = locale;
}
