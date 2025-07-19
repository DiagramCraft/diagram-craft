import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import type { SimpleCRDTMapper } from './mappedCrdt';

export class MappedCRDTProp<
  C extends { [key: string]: CRDTCompatibleObject },
  N extends keyof C & string,
  T
> {
  #value: T | undefined;

  constructor(
    private readonly crdt: WatchableValue<CRDTMap<C>>,
    private readonly name: N,
    private readonly mapper: SimpleCRDTMapper<T, C[N]>,
    props: {
      onRemoteChange?: () => void;
      factory?: () => C[N];
    } = {}
  ) {
    props.onRemoteChange ??= () => {};

    let oldCrdt = crdt.get();
    oldCrdt.get(name, props.factory);

    if (this.crdt.get().has(this.name)) {
      this.#value = this.mapper.fromCRDT(this.crdt.get().get(this.name) as C[N]);
    }

    const remoteUpdate: EventReceiver<CRDTMapEvents<C[string]>['remoteUpdate']> = p => {
      if (p.key !== name) return;
      this.#value = this.mapper.fromCRDT(p.value as C[N]);
      props.onRemoteChange!();
    };

    crdt.get().on('remoteUpdate', remoteUpdate);

    crdt.on('change', () => {
      assert.present(oldCrdt);

      oldCrdt.off('remoteUpdate', remoteUpdate);

      crdt.get().on('remoteUpdate', remoteUpdate);

      oldCrdt = crdt.get();
      oldCrdt.get(name, props.factory);
    });
  }

  get(): T | undefined {
    return this.#value;
  }

  getNonNull(): T {
    const v = this.get();
    assert.present(v);
    return v;
  }

  set(v: T) {
    this.#value = v;
    this.crdt.get().set(this.name, this.mapper.toCRDT(v) as C[N]);
  }

  init(v: T) {
    if (!this.crdt.get().has(this.name)) {
      this.#value = v;
      this.crdt.get().set(this.name, this.mapper.toCRDT(v) as C[N]);
    }
  }
}
