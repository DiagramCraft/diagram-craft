// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, any>;

export type EventKey<T> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

export interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
  off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
  emit<K extends EventKey<T>>(eventName: K, params: T[K]): void;
}

export class EventEmitter<T extends EventMap> implements Emitter<T> {
  private listeners: {
    [K in keyof T]?: Array<EventReceiver<T[K]>>;
  } = {};

  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).concat(fn);
  }

  off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(f => f !== fn);
  }

  // TODO: Add debounce here somehow
  emit<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    [...(this.listeners[eventName] ?? []), ...(this.listeners['*'] ?? [])].forEach(function (fn) {
      fn({ ...(params ?? {}) } as T[K]);
    });
  }
}
