import { assert } from '@diagram-craft/utils/assert';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { CRDTCompatibleObject, CRDTMap } from '../../crdt';
import {
  createMappedCRDTMapLifecycle,
  type MappedCRDTMapLifecycle
} from './mappedCrdtMapLifecycle';
import type { CRDTMapper } from './types';

export type MappedCRDTMapMapType<T extends Record<string, CRDTCompatibleObject>> = Record<
  string,
  CRDTMap<T>
>;

type Props<T> = {
  onRemoteAdd?: (value: T) => void;
  onRemoteRemove?: (id: string, value: T) => void;
  onRemoteChange?: (value: T) => void;
  onInit?: (value: T) => void;
};

export class MappedCRDTMap<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>
> {
  #map = new Map<string, T>();
  readonly #lifecycle: MappedCRDTMapLifecycle<CRDTMap<C>>;

  constructor(
    crdt: WatchableValue<CRDTMap<MappedCRDTMapMapType<C>>>,
    private readonly mapper: CRDTMapper<T, CRDTMap<C>>,
    props?: Props<T>
  ) {
    const populate = (current: CRDTMap<MappedCRDTMapMapType<C>>, notifyInit: boolean) => {
      this.#map.clear();
      for (const [key, value] of current.entries()) {
        this.#map.set(key, this.mapper.fromCRDT(value));
      }
      if (notifyInit) {
        for (const value of this.#map.values()) {
          props?.onInit?.(value);
        }
      }
    };

    this.#lifecycle = createMappedCRDTMapLifecycle({
      crdt,
      initialize: current => populate(current, true),
      replace: current => populate(current, true),
      onRemoteInsert: event => {
        this.#map.set(event.key, this.mapper.fromCRDT(event.value));
        props?.onRemoteAdd?.(this.#map.get(event.key)!);
      },
      onRemoteUpdate: event => {
        this.#map.set(event.key, this.mapper.fromCRDT(event.value));
        props?.onRemoteChange?.(this.#map.get(event.key)!);
      },
      onRemoteDelete: event => {
        props?.onRemoteRemove?.(event.key, this.mapper.fromCRDT(event.value));
        this.#map.delete(event.key);
      }
    });
  }

  clear() {
    this.#lifecycle.current.clear();
    this.#map.clear();
  }

  get entries() {
    return this.#map.entries();
  }

  get values() {
    return this.#map.values();
  }

  get keys() {
    return this.#map.keys();
  }

  get size() {
    return this.#map.size;
  }

  get(key: string) {
    return this.#map.get(key);
  }

  add(key: string, value: T) {
    assert.false(this.#lifecycle.current.has(key));
    this.set(key, value);
  }

  set(key: string, value: T) {
    this.#map.set(key, value);
    this.#lifecycle.current.set(key, this.mapper.toCRDT(value));
  }

  remove(key: string) {
    this.#lifecycle.current.delete(key);
    return this.#map.delete(key);
  }

  toJSON() {
    return Object.fromEntries(this.#map.entries());
  }

  release() {
    this.#lifecycle.release();
  }
}
