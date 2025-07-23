import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import type { CRDTMapper } from './types';

export class MappedCRDTProp<
  C extends { [key: string]: CRDTCompatibleObject },
  N extends keyof C & string,
  T
> {
  #value: T | undefined;
  #current: CRDTMap<C>;

  constructor(
    crdt: WatchableValue<CRDTMap<C>>,
    private readonly name: N,
    private readonly mapper: CRDTMapper<T, C[N]>,
    props: {
      onRemoteChange?: () => void;
      factory?: () => C[N];
    } = {}
  ) {
    props.onRemoteChange ??= () => {};

    this.#current = crdt.get();
    this.#current.get(name, props.factory);

    if (this.#current.has(this.name)) {
      this.#value = this.mapper.fromCRDT(this.#current.get(this.name) as C[N]);
    }

    const remoteUpdate: EventReceiver<CRDTMapEvents<C[string]>['remoteUpdate']> = p => {
      if (p.key !== name) return;
      this.#value = this.mapper.fromCRDT(p.value as C[N]);
      props.onRemoteChange!();
    };

    this.#current.on('remoteUpdate', remoteUpdate);

    crdt.on('change', () => {
      this.#current.off('remoteUpdate', remoteUpdate);

      this.#current = crdt.get();
      this.#current.on('remoteUpdate', remoteUpdate);
      this.#current.get(name, props.factory);
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
    this.#current.set(this.name, this.mapper.toCRDT(v) as C[N]);
  }

  init(v: T) {
    if (!this.#current.has(this.name)) {
      this.#value = v;
      this.#current.set(this.name, this.mapper.toCRDT(v) as C[N]);
    }
  }
}
