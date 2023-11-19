import { EventEmitter, EventMap } from '../../utils/event.ts';
import { useEffect } from 'react';

// TODO: The types can probably be fixed in here

export const useEventListener = <T extends EventMap, K extends keyof T>(
  emitter: EventEmitter<T>,
  action: K,
  callback: (arg: T[K]) => void
) => {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emitter.on(action as unknown as any, callback);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emitter.off(action as unknown as any, callback);
    };
  }, [emitter, action, callback]);
};
