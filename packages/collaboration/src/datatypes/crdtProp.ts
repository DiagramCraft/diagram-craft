import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';
import type { Releasable } from '@diagram-craft/utils/releasable';

export class CRDTProp<
  T extends { [key: string]: CRDTCompatibleObject },
  N extends keyof T & string
> implements Releasable {
  #cachedValue: T[N] | undefined;
  #current: CRDTMap<T>;
  readonly #remoteUpdate: EventReceiver<CRDTMapEvents['remoteUpdate']> | undefined;
  readonly #unsubscribeChange: () => void;

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
    if (props.factory) this.#current.get(name, props.factory);

    this.#remoteUpdate = props.onRemoteChange
      ? ((p => {
          if (p.key !== name) return;
          props.onRemoteChange!();
        }) as EventReceiver<CRDTMapEvents['remoteUpdate']>)
      : undefined;

    if (this.#remoteUpdate) crdt.get().on('remoteUpdate', this.#remoteUpdate);

    this.#unsubscribeChange = crdt.on('change', () => {
      if (this.#remoteUpdate) this.#current.off('remoteUpdate', this.#remoteUpdate);

      this.#current = crdt.get();
      if (this.#remoteUpdate) this.#current.on('remoteUpdate', this.#remoteUpdate);
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
    return this.#cachedValue ?? this.#current.get(this.name, this.props.factory);
  }

  getNonNull() {
    const v = this.#cachedValue ?? this.#current.get(this.name, this.props.factory);
    assert.present(
      v,
      `Can't get ${this.name}. cache=${this.props.cache}, cachedValue=${JSON.stringify(this.#cachedValue)}`
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

  release() {
    this.#unsubscribeChange();
    if (this.#remoteUpdate) this.#current.off('remoteUpdate', this.#remoteUpdate);
  }
}
