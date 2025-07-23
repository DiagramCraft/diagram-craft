import { assert } from '@diagram-craft/utils/assert';
import { type CRDTMapper } from './types';
import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';

export type MappedCRDTMapMapType<T extends Record<string, CRDTCompatibleObject>> = Record<
  string,
  CRDTMap<T>
>;

type Props<T> = {
  onRemoteAdd?: (e: T) => void;
  onRemoteRemove?: (e: T) => void;
  onRemoteChange?: (e: T) => void;
  onInit?: (e: T) => void;
};

export class MappedCRDTMap<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>
> {
  #map: Map<string, T> = new Map<string, T>();
  #current: CRDTMap<MappedCRDTMapMapType<C>>;

  constructor(
    crdt: WatchableValue<CRDTMap<MappedCRDTMapMapType<C>>>,
    private readonly mapper: CRDTMapper<T, CRDTMap<C>>,
    props?: Props<T>
  ) {
    this.#current = crdt.get();

    const setFromCRDT = () => {
      this.#map.clear();
      for (const [k, v] of this.#current.entries()) {
        this.#map.set(k, this.mapper.fromCRDT(v));
      }
      for (const e of this.#map.entries()) {
        props?.onInit?.(e[1]);
      }
    };

    const remoteUpdate: EventReceiver<CRDTMapEvents['remoteUpdate']> = e => {
      this.#map.set(e.key, mapper.fromCRDT(e.value));
      props?.onRemoteChange?.(this.#map.get(e.key)!);
    };

    const remoteDelete: EventReceiver<CRDTMapEvents['remoteDelete']> = e => {
      props?.onRemoteRemove?.(mapper.fromCRDT(e.value));
      this.#map.delete(e.key);
    };

    const remoteInsert: EventReceiver<CRDTMapEvents['remoteDelete']> = e => {
      this.#map.set(e.key, mapper.fromCRDT(e.value));
      props?.onRemoteAdd?.(this.#map.get(e.key)!);
    };

    this.#current.on('remoteUpdate', remoteUpdate);
    this.#current.on('remoteDelete', remoteDelete);
    this.#current.on('remoteInsert', remoteInsert);

    crdt.on('change', () => {
      this.#current.off('remoteUpdate', remoteUpdate);
      this.#current.off('remoteDelete', remoteDelete);
      this.#current.off('remoteInsert', remoteInsert);

      this.#current = crdt.get();
      this.#current.on('remoteUpdate', remoteUpdate);
      this.#current.on('remoteDelete', remoteDelete);
      this.#current.on('remoteInsert', remoteInsert);
      setFromCRDT();
    });

    setFromCRDT();
  }

  clear() {
    this.#current.clear();
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

  add(key: string, t: T) {
    assert.false(this.#current.has(key));
    this.set(key, t);
  }

  set(key: string, t: T) {
    this.#map.set(key, t);
    this.#current.set(key, this.mapper.toCRDT(t));
  }

  remove(key: string) {
    this.#current.delete(key);
    return this.#map.delete(key);
  }

  toJSON() {
    return Object.fromEntries(this.#map.entries());
  }
}
