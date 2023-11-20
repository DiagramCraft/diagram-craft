// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, any>;

type WithWildcardEvent<T> = {
  [K in keyof T]: T[K];
} & {
  '*': T[keyof T] & { name: string };
};

export type EventKey<T> = string & keyof T;
export type EventReceiver<T> = (params: T & { name: string }) => void;

export interface Emitter<T extends EventMap, Q = WithWildcardEvent<T>> {
  on<K extends EventKey<Q>>(eventName: K, fn: EventReceiver<Q[K]>): void;
  off<K extends EventKey<Q>>(eventName: K, fn: EventReceiver<Q[K]>): void;
  emit<K extends EventKey<Q>>(eventName: K, params: Q[K]): void;
}

export class EventEmitter<T extends EventMap, Q = WithWildcardEvent<T>> implements Emitter<T, Q> {
  private listeners: {
    [K in keyof EventMap]?: Array<(p: EventMap[K]) => void>;
  } = {};

  on<K extends EventKey<Q>>(eventName: K, fn: EventReceiver<Q[K]>) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).concat(fn);
  }

  off<K extends EventKey<Q>>(eventName: K, fn: EventReceiver<Q[K]>) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(f => f !== fn);
  }

  // TODO: Add debounce here somehow
  emit<K extends EventKey<Q>>(eventName: K, params?: Q[K]) {
    [...(this.listeners[eventName] ?? []), ...(this.listeners['*'] ?? [])].forEach(function (fn) {
      fn({ ...(params ?? {}), name: eventName });
    });
  }
}
