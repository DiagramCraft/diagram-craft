import { DeepReadonly } from '@diagram-craft/utils/types';
import type { CRDTCompatibleObject, CRDTMap } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { DynamicValue } from '@diagram-craft/utils/dynamicValue';
import { FlatObjectMapProxy, fromFlatObjectMap } from '@diagram-craft/utils/flatObject';

export class CRDTObject<T extends CRDTCompatibleObject & object> {
  #proxy: T | undefined;
  #current: CRDTMap;

  constructor(
    crdt: WatchableValue<CRDTMap>,
    readonly onRemoteChange: () => void
  ) {
    this.#current = crdt.get();
    this.#current.on('remoteAfterTransaction', onRemoteChange);

    crdt.on('change', () => {
      this.#current.off('remoteAfterTransaction', onRemoteChange);

      this.#current = crdt.get();
      this.#current.on('remoteAfterTransaction', onRemoteChange);
    });
  }

  get crdt() {
    return this.#current;
  }

  get(): DeepReadonly<T> {
    this.#proxy ??= this.createProxy();
    return this.#proxy;
  }

  getClone(): DeepReadonly<T> {
    return fromFlatObjectMap(this.#current) as DeepReadonly<T>;
  }

  update(callback: (obj: T) => void) {
    this.#proxy ??= this.createProxy();
    this.#current.transact(() => callback(this.#proxy!));
  }

  set(obj: T) {
    this.#proxy ??= this.createProxy();
    this.#current.transact(() => {
      // First, find all top-level keys that exist in the CRDT but not in the new object
      const existingTopLevelKeys = new Set(
        Array.from(this.#current.keys()).map(k => k.split('.')[0])
      );
      const newKeys = new Set(Object.keys(obj));

      // Delete keys that are missing from the new object
      for (const key of existingTopLevelKeys.difference(newKeys)) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        this.#proxy![key as keyof T] = undefined as any;
      }

      // Then set the new values
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          // @ts-expect-error
          this.#proxy![i] = obj[i];
        }
      } else {
        for (const key in obj) {
          this.#proxy![key] = obj[key];
        }
      }
    });
  }

  init(obj: T) {
    if (Array.from(this.#current.keys()).length === 0) {
      this.set(obj);
    }
  }

  createProxy(): T {
    return FlatObjectMapProxy.create<T, CRDTCompatibleObject>(
      new DynamicValue(() => this.crdt),
      () => this.getClone()
    );
  }
}
