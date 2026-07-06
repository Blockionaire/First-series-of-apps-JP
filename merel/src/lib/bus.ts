/** Minimal typed event bus for cross-component state notifications. */
type Handler = () => void;

const handlers = new Map<string, Set<Handler>>();

export type BusEvent =
  | 'cart:change'
  | 'lang:change'
  | 'recent:change'
  | 'wish:change'
  | 'route:change';

export function on(event: BusEvent, fn: Handler): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(fn);
  return () => set!.delete(fn);
}

export function emit(event: BusEvent): void {
  handlers.get(event)?.forEach((fn) => fn());
}
