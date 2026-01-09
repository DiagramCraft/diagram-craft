import { assert } from '@diagram-craft/utils/assert';
import { type CRDTMapper } from './types';
import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';

// biome-ignore lint/suspicious/noExplicitAny: false positive
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
  #current: CRDTMap<MappedCRDTOrderedMapMapType<C>>;

  constructor(
    crdt: WatchableValue<CRDTMap<MappedCRDTOrderedMapMapType<C>>>,
    private readonly mapper: CRDTMapper<T, CRDTMap<C>>,
    props?: {
      onRemoteAdd?: (e: T) => void;
      onRemoteRemove?: (e: T) => void;
      onRemoteChange?: (e: T) => void;
      onInit?: (e: T) => void;
    }
  ) {
    this.#current = crdt.get();

    const remoteUpdate: EventReceiver<CRDTMapEvents['remoteUpdate']> = e => {
      const idx = this.#entries.findIndex(entry => entry[0] === e.key);
      if (idx >= 0) {
        props?.onRemoteChange?.(this.#entries[idx]![1]);
      }

      this.populateFromCRDT(e);
    };

    const remoteDelete: EventReceiver<CRDTMapEvents['remoteDelete']> = e => {
      const idx = this.#entries.findIndex(entry => entry[0] === e.key);
      if (idx >= 0) {
        props?.onRemoteRemove?.(this.#entries[idx]![1]);
        this.#entries.splice(idx, 1);
      }
    };

    const remoteInsert: EventReceiver<CRDTMapEvents['remoteInsert']> = e => {
      this.populateFromCRDT(e);
      const idx = this.#entries.findIndex(entry => entry[0] === e.key);
      if (idx >= 0) {
        props?.onRemoteAdd?.(this.#entries[idx]![1]);
      }
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
    });

    this.populateFromCRDT();
    for (const e of this.#entries) {
      props?.onInit?.(e[1]);
    }
  }

  get keys() {
    return this.#entries.map(e => e[0]);
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

  clear() {
    this.#current.clear();
    this.#entries = [];
  }

  get(key: string) {
    return this.#entries.find(e => e[0] === key)?.[1];
  }

  has(key: string) {
    return this.#current.has(key);
  }

  set(elements: Array<[string, T]>) {
    this.#current.clear();
    this.#entries = [];
    for (const [key, value] of elements) {
      this.add(key, value);
    }
  }

  setIndex(key: string, toIndex: number) {
    for (const [k, v] of this.#current.entries()) {
      if (k === key) {
        v.set('index', toIndex);
      } else if (v.get('index')! >= toIndex) {
        v.set('index', v.get('index')! + 1);
      }
    }
  }

  /** @deprecated */
  getIndex(key: string) {
    return this.#current.get(key)?.get('index') ?? -1;
  }

  get0Index(key: string) {
    return (this.#current.get(key)?.get('index') ?? 0) - 1;
  }

  add(key: string, t: T) {
    assert.false(this.#current.has(key));

    this.#entries.push([key, t]);

    const entry = this.#current.factory.makeMap<WrapperType>();
    entry.set('index', this.#entries.length);
    entry.set('value', this.mapper.toCRDT(t));
    this.#current.set(key, entry);
  }

  insert(key: string, t: T, position: number) {
    assert.false(this.#current.has(key));
    assert.true(position >= 0 && position <= this.#entries.length);

    // Determine the target CRDT index based on position
    // CRDT indices can have gaps after removals, so we can't just use position + 1
    let targetIndex: number;

    if (position === 0) {
      targetIndex = 1;
    } else if (position === this.#entries.length) {
      const lastElement = this.#entries.at(-1)!;
      targetIndex = this.#current.get(lastElement[0])!.get('index')! + 1;
    } else {
      const elementAtPosition = this.#entries[position]!;
      targetIndex = this.#current.get(elementAtPosition[0])!.get('index')!;
    }

    this.#current.transact(() => {
      // Update indices of existing elements at or after the insertion position
      // Only needed if not inserting at the end
      if (position < this.#entries.length) {
        for (const [, v] of this.#current.entries()) {
          const currentIndex = v.get('index')!;
          if (currentIndex >= targetIndex) {
            v.set('index', currentIndex + 1);
          }
        }
      }

      // Create and insert the new entry
      const entry = this.#current.factory.makeMap<WrapperType>();
      entry.set('index', targetIndex);
      entry.set('value', this.mapper.toCRDT(t));
      this.#current.set(key, entry);
    });

    // Add to local entries and sort by CRDT index
    this.#entries.push([key, t]);
    this.#entries.sort((a, b) => {
      const indexA = this.#current.get(a[0])?.get('index') ?? 0;
      const indexB = this.#current.get(b[0])?.get('index') ?? 0;
      return indexA - indexB;
    });
  }

  update(key: string, t: T) {
    // TODO: Was this ever needed
    //    this.#current.delete(key);

    const entry = this.#current.factory.makeMap<WrapperType>();
    entry.set('index', this.#entries.length);
    entry.set('value', this.mapper.toCRDT(t));
    this.#current.set(key, entry);

    if (this.#entries.find(e => e[0] === key)) {
      this.#entries = this.#entries.map(e => (e[0] === key ? [key, t] : e));
    } else {
      this.#entries.push([key, t]);
    }
  }

  remove(key: string) {
    const idx = this.#entries.findIndex(e => e[0] === key);
    if (idx >= 0) {
      this.#entries.splice(idx, 1);
      this.#current.delete(key);
      return true;
    }
    this.#current.delete(key);
    return false;
  }

  toJSON() {
    return Object.fromEntries(this.#entries);
  }

  // TODO: We could optimize the update events if we have a postTransaction
  //       listener - in that case we can set the entries at the end of
  //       the transaction, instead of doing for each element
  setOrder(keys: string[]) {
    this.#current.transact(() => {
      for (const [k, v] of this.#current.entries()) {
        const idx = keys.indexOf(k);
        if (idx >= 0) {
          if (v.get('index') !== idx) v.set('index', idx);
        }
      }
    });

    this.#entries = Array.from(this.#current.entries())
      .toSorted(([, v1], [, v2]) => v1.get('index')! - v2.get('index')!)
      .map(([k, v]) => {
        const existing = this.#entries.find(e => e[0] === k);
        return [k, existing?.[1] ?? this.mapper.fromCRDT(v.get('value')!)];
      });
  }

  private populateFromCRDT(e?: { key: string; value: CRDTMap<WrapperType<C>> }) {
    const entryMap = Object.fromEntries(this.#entries);

    this.#entries = Array.from(this.#current.entries())
      .toSorted(([, v1], [, v2]) => v1.get('index')! - v2.get('index')!)
      .map(([k, v]) => {
        if (e && e.key === k) return [k, this.mapper.fromCRDT(v.get('value')!)];
        else return [k, entryMap[k] ?? this.mapper.fromCRDT(v.get('value')!)];
      });
  }
}
