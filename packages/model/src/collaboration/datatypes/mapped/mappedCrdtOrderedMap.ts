import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { CRDTMapper } from './mappedCrdt';
import type { CRDTCompatibleObject, CRDTMap } from '../../crdt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WrapperType<T extends Record<string, CRDTCompatibleObject> = any> = {
  value: CRDTMap<T>;
  index: number;
};

export type MappedCRDTOrderedMapMapType<T extends Record<string, CRDTCompatibleObject>> = Record<
  string,
  CRDTMap<WrapperType<T>>
>;

export class MappedCRDTOrderedMap<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>
> {
  #entries: Array<[string, T]> = [];

  constructor(
    private readonly crdt: CRDTMap<MappedCRDTOrderedMapMapType<C>>,
    private readonly mapper: CRDTMapper<T, C>,
    allowUpdates = false
  ) {
    const setFromCRDT = () => {
      const entryMap = Object.fromEntries(this.#entries);

      this.#entries = Array.from(this.crdt.entries())
        .toSorted(([, v1], [, v2]) => v1.get('index')! - v2.get('index')!)
        .map(([k, v]) => [k, entryMap[k] ?? this.mapper.fromCRDT(v.get('value')!)]);
    };

    crdt.on('remoteUpdate', e => {
      if (allowUpdates) {
        const entryMap = Object.fromEntries(this.#entries);

        this.#entries = Array.from(crdt.entries())
          .toSorted(([, v1], [, v2]) => v1.get('index')! - v2.get('index')!)
          .map(([k, v]) => [k, e.key !== k ? entryMap[k] : mapper.fromCRDT(v.get('value')!)]);
      } else {
        // Note: Updates are handled by the T entry itself to avoid having to
        //       reconstruct the object from the underlying CRDT
        VERIFY_NOT_REACHED();
      }
    });
    crdt.on('remoteDelete', e => {
      const idx = this.#entries.findIndex(entry => entry[0] === e.key);
      if (idx >= 0) {
        this.#entries.splice(idx, 1);
      }
    });
    crdt.on('remoteInsert', () => setFromCRDT());

    setFromCRDT();
  }

  get entries() {
    return this.#entries;
  }

  get values() {
    return this.#entries.map(e => e[1]);
  }

  get size() {
    return this.#entries.length;
  }

  get(key: string) {
    return this.#entries.find(e => e[0] === key)?.[1];
  }

  has(key: string) {
    return this.crdt.has(key);
  }

  set(elements: Array<[string, T]>) {
    this.crdt.clear();
    this.#entries = [];
    for (const [key, value] of elements) {
      this.add(key, value);
    }
  }

  setIndex(key: string, toIndex: number) {
    for (const [k, v] of this.crdt.entries()) {
      if (k === key) {
        v.set('index', toIndex);
      } else if (v.get('index')! >= toIndex) {
        v.set('index', v.get('index')! + 1);
      }
    }
  }

  getIndex(key: string) {
    return this.crdt.get(key)?.get('index') ?? -1;
  }

  add(key: string, t: T) {
    assert.false(this.crdt.has(key));

    this.#entries.push([key, t]);

    const entry = this.crdt.factory.makeMap<WrapperType>();
    entry.set('index', this.#entries.length);
    entry.set('value', this.mapper.toCRDT(t));
    this.crdt.set(key, entry);
  }

  update(key: string, t: T) {
    this.crdt.delete(key);

    const entry = this.crdt.factory.makeMap<WrapperType>();
    entry.set('index', this.#entries.length);
    entry.set('value', this.mapper.toCRDT(t));
    this.crdt.set(key, entry);

    this.#entries = this.#entries.map(e => (e[0] === key ? [key, t] : e));
  }

  remove(key: string) {
    const idx = this.#entries.findIndex(e => e[0] === key);
    if (idx >= 0) {
      this.#entries.splice(idx, 1);
      this.crdt.delete(key);
      return true;
    }
    this.crdt.delete(key);
    return false;
  }

  toJSON() {
    return Object.fromEntries(this.#entries);
  }
}
