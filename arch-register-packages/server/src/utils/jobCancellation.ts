export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw signal.reason ?? new Error('Job execution aborted');
};

export const linkAbortSignal = (signal?: AbortSignal) => {
  const controller = new AbortController();
  if (!signal) return { controller, cleanup: () => undefined };

  const onAbort = () => controller.abort(signal.reason);
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });

  return {
    controller,
    cleanup: () => signal.removeEventListener('abort', onAbort)
  };
};
