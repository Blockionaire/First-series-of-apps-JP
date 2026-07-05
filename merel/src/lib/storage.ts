/**
 * Safe localStorage wrapper. Every call is guarded: private browsing,
 * blocked storage or quota errors degrade silently to in-memory state.
 */
const memory = new Map<string, string>();

const PREFIX = 'merel:';

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    const raw = memory.get(PREFIX + key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}

export function storageSet(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    memory.set(PREFIX + key, raw);
  }
}

export function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    memory.delete(PREFIX + key);
  }
}
