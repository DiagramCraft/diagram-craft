import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';

export class CRDTProp<
  T extends { [key: string]: CRDTCompatibleObject },
  N extends keyof T & string
> {
  #cachedValue: T[N] | undefined;
  #current: CRDTMap<T>;

  constructor(
    crdt: WatchableValue<CRDTMap<T>>,
    private readonly name: N,
    private readonly props: {
      onRemoteChange?: () => void;
      factory?: () => T[N];
      initialValue?: T[N];
      cache?: boolean;
    } = {}
  ) {
    this.#current = crdt.get();
    this.#current.get(name, props.factory);

    const remoteUpdate = props.onRemoteChange
      ? ((p => {
          if (p.key !== name) return;
          props.onRemoteChange!();
        }) as EventReceiver<CRDTMapEvents['remoteUpdate']>)
      : undefined;

    if (remoteUpdate) crdt.get().on('remoteUpdate', remoteUpdate);

    crdt.on('change', () => {
      if (remoteUpdate) this.#current.off('remoteUpdate', remoteUpdate);

      this.#current = crdt.get();
      if (remoteUpdate) this.#current.on('remoteUpdate', remoteUpdate);
      this.#current.get(name, props.factory);
    });

    if (props.initialValue !== undefined) {
      this.init(props.initialValue);
    }

    if (props.cache) {
      this.#cachedValue = this.get();
    }
  }

  get() {
    return (
      (this.props.cache ? this.#cachedValue : undefined) ??
      this.#current.get(this.name, this.props.factory)
    );
  }

  getNonNull() {
    const v =
      (this.props.cache ? this.#cachedValue : undefined) ??
      this.#current.get(this.name, this.props.factory);
    assert.present(
      v,
      `Can't get ${this.name}. cache=${this.props.cache}, cachedValue=${this.#cachedValue}`
    );
    return v;
  }

  set(v: T[N]) {
    this.#current.set(this.name, v);
    if (this.props.cache) {
      this.#cachedValue = v;
    }
  }

  init(v: T[N]) {
    if (!this.#current.has(this.name)) {
      this.#current.set(this.name, v);
      if (this.props.cache) {
        this.#cachedValue = v;
      }
    }
  }
}
