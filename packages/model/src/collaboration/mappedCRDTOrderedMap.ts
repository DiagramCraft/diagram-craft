import { CRDT, CRDTCompatibleObject, CRDTMap } from './crdt';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

export type MappedCRDTOrderedMapMapType<T extends Record<string, CRDTCompatibleObject>> = Record<
  string,
  CRDTMap<{ value: CRDTMap<T>; index: number }>
>;

export class MappedCRDTOrderedMap<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>,
  CA extends {
    value: CRDTMap<C>;
    index: number;
  } = {
    value: CRDTMap<C>;
    index: number;
  }
> {
  #entries: Array<[string, T]> = [];

  constructor(
    private readonly map: CRDTMap<Record<string, CRDTMap<CA>>>,
    readonly fromCRDT: (e: CRDTMap<C>) => T,
    private readonly toCRDT: (e: T) => CRDTMap<C>,
    allowUpdates = false
  ) {
    map.on('remoteUpdate', e => {
      if (allowUpdates) {
        const entryMap = Object.fromEntries(this.#entries);

        this.#entries = Array.from(map.entries())
          .toSorted(([, v1], [, v2]) => v1.get('index')! - v2.get('index')!)
          .map(([k, v]) => [k, e.key !== k ? entryMap[k] : fromCRDT(v.get('value')!)]);
      } else {
        console.log('remoteUpdate');
        // Note: Updates are handled by the T entry itself to avoid having to
        //       reconstruct the object from the underlying CRDT
        console.log(e);
        VERIFY_NOT_REACHED();
      }
    });
    map.on('remoteDelete', e => {
      const idx = this.#entries.findIndex(entry => entry[0] === e.key);
      if (idx >= 0) {
        this.#entries.splice(idx, 1);
      }
    });
    map.on('remoteInsert', () => {
      const entryMap = Object.fromEntries(this.#entries);

      this.#entries = Array.from(map.entries())
        .toSorted(([, v1], [, v2]) => v1.get('index')! - v2.get('index')!)
        .map(([k, v]) => [k, entryMap[k] ?? fromCRDT(v.get('value')!)]);
    });
  }

  get entries() {
    return this.#entries;
  }

  get values() {
    return this.#entries.map(e => e[1]);
  }

  add(key: string, t: T) {
    assert.false(this.map.has(key));

    this.#entries.push([key, t]);

    const entry = new CRDT.Map();
    entry.set('index', this.#entries.length);
    entry.set('value', this.toCRDT(t));
    this.map.set(key, entry);
  }

  remove(key: string) {
    const idx = this.#entries.findIndex(e => e[0] === key);
    if (idx >= 0) {
      this.#entries.splice(idx, 1);
      this.map.delete(key);
      return true;
    }
    return false;
  }

  toJSON() {
    return Object.fromEntries(this.#entries);
  }
}
