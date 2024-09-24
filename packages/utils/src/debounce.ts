/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

export const debounce = (fn: Function, ms = 0) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

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
