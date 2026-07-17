import { assert } from '@diagram-craft/utils/assert';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { CRDTCompatibleObject, CRDTMap } from '../../crdt';
import {
  createMappedCRDTMapLifecycle,
  type MappedCRDTMapLifecycle
} from './mappedCrdtMapLifecycle';
import type { CRDTMapper } from './types';

export type MappedCRDTOrderedMapEntry<T extends Record<string, CRDTCompatibleObject>> = {
  value: CRDTMap<T>;
  index: number;
};

export type MappedCRDTOrderedMapMapType<T extends Record<string, CRDTCompatibleObject>> = Record<
  string,
  CRDTMap<MappedCRDTOrderedMapEntry<T>>
>;

type WrapperType<C extends Record<string, CRDTCompatibleObject>> = MappedCRDTOrderedMapEntry<C>;

type Props<T> = {
  onRemoteAdd?: (value: T) => void;
  onRemoteRemove?: (value: T) => void;
  onRemoteChange?: (value: T) => void;
  onInit?: (value: T) => void;
};

export class MappedCRDTOrderedMap<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>
> {
  #entries: Array<[string, T]> = [];
  readonly #lifecycle: MappedCRDTMapLifecycle<CRDTMap<WrapperType<C>>>;

  constructor(
    crdt: WatchableValue<CRDTMap<MappedCRDTOrderedMapMapType<C>>>,
    private readonly mapper: CRDTMapper<T, CRDTMap<C>>,
    props?: Props<T>
  ) {
    const populateFromCRDT = (
      current: CRDTMap<MappedCRDTOrderedMapMapType<C>>,
      event?: { key: string; value: CRDTMap<WrapperType<C>> }
    ) => {
      const existing = Object.fromEntries(this.#entries);

      this.#entries = Array.from(current.entries())
        .toSorted(([, first], [, second]) => first.get('index')! - second.get('index')!)
        .map(([key, value]) => {
          if (event && event.key === key) {
            return [key, this.mapper.fromCRDT(value.get('value')!)] as [string, T];
          }
          return [key, existing[key] ?? this.mapper.fromCRDT(value.get('value')!)] as [string, T];
        });
    };

    this.#lifecycle = createMappedCRDTMapLifecycle({
      crdt,
      initialize: current => {
        populateFromCRDT(current);
        for (const [, value] of this.#entries) {
          props?.onInit?.(value);
        }
      },
      replace: current => populateFromCRDT(current),
      onRemoteUpdate: (event, current) => {
        const index = this.#entries.findIndex(([key]) => key === event.key);
        if (index >= 0) {
          props?.onRemoteChange?.(this.#entries[index]![1]);
        }
        populateFromCRDT(current, event);
      },
      onRemoteDelete: event => {
        const index = this.#entries.findIndex(([key]) => key === event.key);
        if (index >= 0) {
          props?.onRemoteRemove?.(this.#entries[index]![1]);
          this.#entries.splice(index, 1);
        }
      },
      onRemoteInsert: (event, current) => {
        populateFromCRDT(current, event);
        const index = this.#entries.findIndex(([key]) => key === event.key);
        if (index >= 0) {
          props?.onRemoteAdd?.(this.#entries[index]![1]);
        }
      }
    });
  }

  get keys() {
    return this.#entries.map(([key]) => key);
  }

  get entries() {
    return this.#entries;
  }

  get values() {
    return this.#entries.map(([, value]) => value);
  }

  get size() {
    return this.#entries.length;
  }

  clear() {
    this.#lifecycle.current.clear();
    this.#entries = [];
  }

  get(key: string) {
    return this.#entries.find(([entryKey]) => entryKey === key)?.[1];
  }

  has(key: string) {
    return this.#lifecycle.current.has(key);
  }

  set(elements: Array<[string, T]>) {
    this.#lifecycle.current.clear();
    this.#entries = [];
    for (const [key, value] of elements) {
      this.add(key, value);
    }
  }

  getIndex(key: string) {
    return this.#entries.findIndex(([entryKey]) => entryKey === key);
  }

  add(key: string, value: T) {
    assert.false(this.#lifecycle.current.has(key));

    this.#entries.push([key, value]);

    const entry = this.#lifecycle.current.factory.makeMap<WrapperType<C>>();
    entry.set('index', this.#entries.length);
    entry.set('value', this.mapper.toCRDT(value));
    this.#lifecycle.current.set(key, entry);
  }

  insert(key: string, value: T, position: number) {
    assert.false(this.#lifecycle.current.has(key));
    assert.true(
      position >= 0 && position <= this.#entries.length,
      `Invalid position ${position} for insert, length ${this.#entries.length}`
    );

    this.#entries.splice(position, 0, [key, value]);

    this.#lifecycle.current.transact(() => {
      const entry = this.#lifecycle.current.factory.makeMap<WrapperType<C>>();
      entry.set('index', position);
      entry.set('value', this.mapper.toCRDT(value));
      this.#lifecycle.current.set(key, entry);

      for (const [entryKey, entryValue] of this.#lifecycle.current.entries()) {
        const index = this.#entries.findIndex(([key]) => key === entryKey);
        if (entryValue.get('index') !== index) entryValue.set('index', index);
      }
    });
  }

  update(key: string, value: T) {
    const entry = this.#lifecycle.current.factory.makeMap<WrapperType<C>>();
    entry.set('index', this.#entries.length);
    entry.set('value', this.mapper.toCRDT(value));
    this.#lifecycle.current.set(key, entry);

    if (this.#entries.find(([entryKey]) => entryKey === key)) {
      this.#entries = this.#entries.map(
        entry => (entry[0] === key ? [key, value] : entry) as [string, T]
      );
    } else {
      this.#entries.push([key, value]);
    }
  }

  remove(key: string) {
    const index = this.#entries.findIndex(([entryKey]) => entryKey === key);
    if (index >= 0) {
      this.#entries.splice(index, 1);
      this.#lifecycle.current.delete(key);
      return true;
    }
    this.#lifecycle.current.delete(key);
    return false;
  }

  toJSON() {
    return Object.fromEntries(this.#entries);
  }

  setOrder(keys: string[]) {
    this.#lifecycle.current.transact(() => {
      for (const [key, value] of this.#lifecycle.current.entries()) {
        const index = keys.indexOf(key);
        if (index >= 0 && value.get('index') !== index) value.set('index', index);
      }
    });

    this.#entries = Array.from(this.#lifecycle.current.entries())
      .toSorted(([, first], [, second]) => first.get('index')! - second.get('index')!)
      .map(([key, value]) => {
        const existing = this.#entries.find(([entryKey]) => entryKey === key);
        return [key, existing?.[1] ?? this.mapper.fromCRDT(value.get('value')!)] as [string, T];
      });
  }

  release() {
    this.#lifecycle.release();
  }
}
