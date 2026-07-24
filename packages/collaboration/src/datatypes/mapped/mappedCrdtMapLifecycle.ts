import type { EventReceiver } from '@diagram-craft/utils/event';
import type { Releasable } from '@diagram-craft/utils/releasable';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { CRDTCompatibleObject, CRDTMap, CRDTMapEvents } from '../../crdt';

export type MappedCRDTMapLifecycle<S extends CRDTCompatibleObject> = Releasable & {
  readonly current: CRDTMap<Record<string, S>>;
};

export const createMappedCRDTMapLifecycle = <S extends CRDTCompatibleObject>(options: {
  crdt: WatchableValue<CRDTMap<Record<string, S>>>;
  initialize: (current: CRDTMap<Record<string, S>>) => void;
  replace: (current: CRDTMap<Record<string, S>>) => void;
  onRemoteInsert: (
    event: CRDTMapEvents<S>['remoteInsert'],
    current: CRDTMap<Record<string, S>>
  ) => void;
  onRemoteUpdate: (
    event: CRDTMapEvents<S>['remoteUpdate'],
    current: CRDTMap<Record<string, S>>
  ) => void;
  onRemoteDelete: (
    event: CRDTMapEvents<S>['remoteDelete'],
    current: CRDTMap<Record<string, S>>
  ) => void;
}): MappedCRDTMapLifecycle<S> => {
  let current = options.crdt.get();
  let released = false;

  const remoteInsert: EventReceiver<CRDTMapEvents<S>['remoteInsert']> = event =>
    options.onRemoteInsert(event, current);
  const remoteUpdate: EventReceiver<CRDTMapEvents<S>['remoteUpdate']> = event =>
    options.onRemoteUpdate(event, current);
  const remoteDelete: EventReceiver<CRDTMapEvents<S>['remoteDelete']> = event =>
    options.onRemoteDelete(event, current);

  const subscribeCurrent = () => {
    current.on('remoteInsert', remoteInsert);
    current.on('remoteUpdate', remoteUpdate);
    current.on('remoteDelete', remoteDelete);
  };

  const unsubscribeCurrent = () => {
    current.off('remoteInsert', remoteInsert);
    current.off('remoteUpdate', remoteUpdate);
    current.off('remoteDelete', remoteDelete);
  };

  subscribeCurrent();
  const unsubscribeChange = options.crdt.on('change', () => {
    unsubscribeCurrent();
    current = options.crdt.get();
    subscribeCurrent();
    options.replace(current);
  });

  options.initialize(current);

  return {
    get current() {
      return current;
    },
    release: () => {
      if (released) return;
      released = true;
      unsubscribeChange();
      unsubscribeCurrent();
    }
  };
};
