import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { type SimpleCRDTMapper } from './mappedCrdt';
import type { CRDTCompatibleObject, CRDTMap } from '../../crdt';

export type MappedCRDTMapMapType<T extends Record<string, CRDTCompatibleObject>> = Record<
  string,
  CRDTMap<T>
>;

export class MappedCRDTMap<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>
> {
  #map: Map<string, T> = new Map<string, T>();

  constructor(
    private readonly crdt: CRDTMap<MappedCRDTMapMapType<C>>,
    private readonly mapper: SimpleCRDTMapper<T, CRDTMap<C>>,
    allowUpdates = false
  ) {
    crdt.on('remoteUpdate', e => {
      if (allowUpdates) {
        this.#map.set(e.key, mapper.fromCRDT(e.value));
      } else {
        // Note: Updates are handled by the T entry itself to avoid having to
        //       reconstruct the object from the underlying CRDT
        VERIFY_NOT_REACHED();
      }
    });
    crdt.on('remoteDelete', e => {
      this.#map.delete(e.key);
    });
    crdt.on('remoteInsert', e => {
      this.#map.set(e.key, mapper.fromCRDT(e.value));
    });

    for (const [k, v] of crdt.entries()) {
      this.#map.set(k, mapper.fromCRDT(v));
    }
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
    assert.false(this.crdt.has(key));
    this.set(key, t);
  }

  set(key: string, t: T) {
    this.#map.set(key, t);
    this.crdt.set(key, this.mapper.toCRDT(t));
  }

  remove(key: string) {
    this.crdt.delete(key);
    return this.#map.delete(key);
  }

  toJSON() {
    return Object.fromEntries(this.#map.entries());
  }
}
