type Source = {
  /** Increases whenever the underlying data changes */
  changeCount: () => number;
};

type Options = {
  sources: Source[];
  /** Captures and stores the current state */
  save: () => Promise<unknown>;
  delayMs?: number;
};

/**
 * Debounced "save when dirty" helper. `notify()` is cheap and is called after every request;
 * it only schedules a save when a source's change counter moved since the last save.
 */
export const createSnapshotPersister = ({ sources, save, delayMs = 2000 }: Options) => {
  const stamp = () => sources.map(s => s.changeCount()).join(',');

  let saved = stamp();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let disabled = false;

  const isDirty = () => stamp() !== saved;

  const run = (): Promise<void> => {
    if (inFlight) return inFlight.then(() => (isDirty() ? run() : undefined));
    if (!isDirty()) return Promise.resolve();
    const current = stamp();
    inFlight = (async () => {
      await save();
      saved = current;
    })()
      .catch(() => {})
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return {
    notify: () => {
      if (disabled || timer !== undefined || !isDirty()) return;
      timer = setTimeout(() => {
        timer = undefined;
        void run();
      }, delayMs);
    },
    /** Saves immediately if dirty (page hide) */
    flush: () => {
      clearTimer();
      return disabled ? Promise.resolve() : run();
    },
    /** Stops all further saves, e.g. while the snapshot is being reset */
    disable: () => {
      disabled = true;
      clearTimer();
    }
  };
};
