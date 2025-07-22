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
  private listeners: {
    [K in keyof T]?: Array<[string, EventReceiver<T[K]>, EventReceiver<T[K]>]>;
  } = {};

  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>, id?: string) {
    this.listeners[eventName] ??= [];
    this.listeners[eventName].push([id ?? newid(), fn, debounceMicrotask(fn)]);
  }

  off<K extends EventKey<T>>(eventName: K, fnOrId: EventReceiver<T[K]> | string) {
    this.listeners[eventName] = (this.listeners[eventName] ?? []).filter(f => {
      if (fnOrId instanceof Function) {
        return f[1] !== fnOrId;
      } else {
        return f[0] !== fnOrId;
      }
    });
  }

  emitAsync<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(function (fn) {
      fn[2]({ ...(params ?? {}) } as T[K]);
    });
  }

  emit<K extends EventKey<T>>(eventName: K, params?: T[K]) {
    (this.listeners[eventName] ?? []).forEach(function (fn) {
      fn[1]({ ...(params ?? {}) } as T[K]);
    });
  }
}
