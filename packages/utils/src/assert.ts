export class VerifyNotReached extends Error {
  constructor(msg?: string) {
    super('Should not be reached ' + (msg ?? ''));
  }
}

export class NotImplementedYet extends Error {
  constructor(msg?: string) {
    super('Not implemented yet ' + (msg ?? ''));
  }
}

export function VERIFY_NOT_REACHED(s?: string): never {
  throw new VerifyNotReached(s);
}

export function NOT_IMPLEMENTED_YET(): never {
  throw new NotImplementedYet();
}

export const is = {
  present: <T = unknown>(arg: T): arg is NonNullable<T> => arg !== null && arg !== undefined,
  notPresent: <T = unknown>(arg: T | undefined): arg is undefined =>
    arg === null || arg === undefined,
  arrayWithExactlyOneElement: (arg: unknown) =>
    is.present(arg) && Array.isArray(arg) && arg.length === 1,
  arrayNotEmpty: <T = unknown>(arg: T[] | undefined | null): arg is [T, ...T[]] =>
    is.present(arg) && Array.isArray(arg) && arg.length >= 1,
  true: (arg: unknown) => arg === true,
  false: (arg: unknown) => arg === false
};

type AssertType = {
  present: <T = unknown>(arg: T, msg?: string) => asserts arg is NonNullable<T>;
  notPresent: <T = unknown>(arg: T | undefined, msg?: string) => asserts arg is undefined;
  arrayWithExactlyOneElement: <T = unknown>(
    arg: readonly T[] | T[] | undefined | null,
    msg?: string
  ) => asserts arg is [T];
  arrayNotEmpty: <T = unknown>(
    arg: T[] | undefined | null,
    msg?: string
  ) => asserts arg is [T, ...T[]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  true: (arg: any, msg?: string) => asserts arg is true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  false: (arg: any, msg?: string) => asserts arg is false;
  fail: (msg?: string) => void;
};

const makeAssertions = (error: (m: string) => void) => ({
  present: <T = unknown>(arg: T, msg?: string): asserts arg is NonNullable<T> => {
    if (!is.present(arg)) error(msg ?? 'not present');
  },
  notPresent: <T = unknown>(arg: T | undefined, msg?: string): asserts arg is undefined => {
    if (!is.notPresent(arg)) error(msg ?? 'not present');
  },
  arrayWithExactlyOneElement: <T = unknown>(
    arg: T[] | readonly T[] | undefined | null,
    msg?: string
  ): asserts arg is [T] => {
    if (!is.arrayWithExactlyOneElement(arg)) error(msg ?? 'array has not exactly one element');
  },
  arrayNotEmpty: <T = unknown>(arg: T[] | undefined | null, msg?: string): asserts arg is [T] => {
    if (!is.arrayNotEmpty(arg)) error(msg ?? 'array has at least one element');
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  true: (arg: any, msg?: string): asserts arg is true => {
    if (!is.true(arg)) error(msg ?? 'must be true');
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  false: (arg: any, msg?: string): asserts arg is true => {
    if (!is.false(arg)) error(msg ?? 'must be false');
  },
  fail: (msg?: string) => {
    error(msg ?? 'fail');
  }
});

export const assert: AssertType = makeAssertions(m => {
  throw new Error(m);
});

export const notImplemented: AssertType = makeAssertions(m => {
  throw new NotImplementedYet(m);
});

export const precondition: { is: AssertType } = { is: assert };

export const postcondition: { is: AssertType } = { is: assert };

export const invariant: { is: AssertType } = { is: assert };
