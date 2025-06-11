import { CRDTCompatibleObject, CRDTMap } from './crdt';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

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
    readonly fromCRDT: (e: CRDTMap<C>) => T,
    private readonly toCRDT: (e: T) => CRDTMap<C>,
    allowUpdates = false
  ) {
    crdt.on('remoteUpdate', e => {
      if (allowUpdates) {
        this.#map.set(e.key, fromCRDT(e.value));
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
      this.#map.set(e.key, fromCRDT(e.value));
    });
  }

  get entries() {
    return this.#map.entries();
  }

  get values() {
    return this.#map.values();
  }

  add(key: string, t: T) {
    assert.false(this.crdt.has(key));
    this.set(key, t);
  }

  set(key: string, t: T) {
    this.#map.set(key, t);
    this.crdt.set(key, this.toCRDT(t));
  }

  remove(key: string) {
    this.crdt.delete(key);
    return this.#map.delete(key);
  }

  toJSON() {
    return Object.fromEntries(this.#map.entries());
  }
}
