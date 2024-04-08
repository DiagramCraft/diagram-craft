/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/ban-types
export const debounce = (fn: Function, ms = 0) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const debounceMicrotask = (fn: Function) => {
  let queued = false;
  return function (this: any, ...args: any[]) {
    if (queued) return;
    queueMicrotask(() => {
      try {
        fn.apply(this, args);
      } finally {
        queued = false;
      }
    });
  };
};
