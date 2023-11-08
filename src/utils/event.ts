// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, any>;

type WithEventNames<T> = {
  [K in keyof T]: T[K] & { name: K };
};

type WithWildcardEvent<T> = WithEventNames<{
  [K in keyof T]: T[K];
}> & {
  '*': T[keyof T];
};

export type EventKey<T> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

export interface Emitter<T extends EventMap, Q = WithWildcardEvent<WithEventNames<T>>> {
  on<K extends EventKey<Q>>(eventName: K, fn: EventReceiver<Q[K]>): void;
  off<K extends EventKey<Q>>(eventName: K, fn: EventReceiver<Q[K]>): void;
  emit<K extends EventKey<Q>>(eventName: K, params: Omit<Q[K], 'name'>): void;
}

export class EventEmitter<T extends EventMap, Q = WithWildcardEvent<WithEventNames<T>>>
  implements Emitter<T, Q>
{
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
  emit<K extends EventKey<Q>>(eventName: K, params?: Omit<Q[K], 'name'>) {
    [...(this.listeners[eventName] ?? []), ...(this.listeners['*'] ?? [])].forEach(function (fn) {
      fn({ ...(params ?? {}), name: eventName });
    });
  }
}
