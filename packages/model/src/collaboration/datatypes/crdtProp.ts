import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { EventReceiver } from '@diagram-craft/utils/event';
import { assert } from '@diagram-craft/utils/assert';

export class CRDTProp<
  T extends { [key: string]: CRDTCompatibleObject },
  N extends keyof T & string
> {
  constructor(
    private readonly crdt: WatchableValue<CRDTMap<T>>,
    private readonly name: N,
    private readonly props: {
      onRemoteChange?: () => void;
      factory?: () => T[N];
      initialValue?: T[N];
    } = {}
  ) {
    props.onRemoteChange ??= () => {};

    let oldCrdt = crdt.get();
    oldCrdt.get(name, props.factory);

    const remoteUpdate: EventReceiver<CRDTMapEvents<T[string]>['remoteUpdate']> = p => {
      if (p.key !== name) return;
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

    if (!this.crdt.get().has(this.name) && props.initialValue !== undefined) {
      this.crdt.get().set(this.name, props.initialValue);
    }
  }

  get() {
    return this.crdt.get().get(this.name, this.props.factory);
  }

  getNonNull() {
    const v = this.crdt.get().get(this.name, this.props.factory);
    assert.present(v);
    return v;
  }

  set(v: T[keyof T & string]) {
    this.crdt.get().set(this.name, v);
  }

  init(v: T[keyof T & string]) {
    if (!this.crdt.get().has(this.name)) {
      this.crdt.get().set(this.name, v);
    }
  }
}
