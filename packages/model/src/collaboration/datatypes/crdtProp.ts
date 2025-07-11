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
      onChange?: (type: 'local' | 'remote') => void;
      factory?: () => T[N];
    } = {}
  ) {
    props.onChange ??= () => {};

    let oldCrdt = crdt.get();
    oldCrdt.get(name, props.factory);

    const localUpdate: EventReceiver<CRDTMapEvents<T[string]>['localUpdate']> = p => {
      if (p.key !== name) return;
      props.onChange!('local');
    };
    const remoteUpdate: EventReceiver<CRDTMapEvents<T[string]>['remoteUpdate']> = p => {
      if (p.key !== name) return;
      props.onChange!('local');
    };

    crdt.get().on('localUpdate', localUpdate);
    crdt.get().on('remoteUpdate', remoteUpdate);

    crdt.on('change', () => {
      assert.present(oldCrdt);

      oldCrdt.off('localUpdate', localUpdate);
      oldCrdt.off('remoteUpdate', remoteUpdate);

      crdt.get().on('localUpdate', localUpdate);
      crdt.get().on('remoteUpdate', remoteUpdate);

      oldCrdt = crdt.get();
      oldCrdt.get(name, props.factory);
    });
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
}
