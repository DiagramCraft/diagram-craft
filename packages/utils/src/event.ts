import { debounceMicrotask } from './debounce';
import { newid } from './id';

export type EventMap = Record<string, unknown>;
export type EventKey<T> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

export interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>, id?: string): void;
  off<K extends EventKey<T>>(eventName: K, fnOrId: EventReceiver<T[K]> | string): void;
}

export class EventEmitter<T extends EventMap> implements Emitter<T> {
  protected listeners: {
    [K in keyof T]?: Array<{
      id: string;
      fn: EventReceiver<T[K]>;
      fnDebounce: EventReceiver<T[K]>;
      fnAsync: EventReceiver<T[K]>;
    }>;
  } = {};

  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>, id?: string) {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push({
      id: id ?? newid(),
      fn: fn,
      fnDebounce: debounceMicrotask(fn),
      fnAsync: e => queueMicrotask(() => fn(e))
    });
  }

  off<K extends EventKey<T>>(eventName: K, fnOrId: EventReceiver<T[K]> | string) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(l => {
      if (fnOrId instanceof Function) {
        return l.fn !== fnOrId;
      } else {
        return l.id !== fnOrId;
      }
    });
  }

  emitAsyncWithDebounce<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(l => {
      l.fnDebounce({ ...(params ?? {}) } as T[K]);
    });
  }

  emitAsync<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(l => {
      l.fnAsync({ ...(params ?? {}) } as T[K]);
    });
  }

  emit<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(l => {
      l.fn({ ...(params ?? {}) } as T[K]);
    });
  }

  protected clearListeners() {
    this.listeners = {};
  }
}
