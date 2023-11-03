export class VerifyNotReached extends Error {
  constructor(msg?: string) {
    super(msg ?? 'Should not be reached');
  }
}

export class NotImplementedYet extends Error {
  constructor(msg?: string) {
    super(msg ?? 'Not implemented yet');
  }
}

export const VERIFY_NOT_REACHED = (): never => {
  throw new VerifyNotReached();
};

export const NOT_IMPLEMENTED_YET = (): never => {
  throw new NotImplementedYet();
};

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
    arg: T[] | undefined | null,
    msg?: string
  ) => asserts arg is [T];
  arrayNotEmpty: <T = unknown>(
    arg: T[] | undefined | null,
    msg?: string
  ) => asserts arg is [T, ...T[]];
  true: (arg: any, msg?: string) => asserts arg is true;
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
    arg: T[] | undefined | null,
    msg?: string
  ): asserts arg is [T] => {
    if (!is.arrayWithExactlyOneElement(arg)) error(msg ?? 'array has not exactly one element');
  },
  arrayNotEmpty: <T = unknown>(arg: T[] | undefined | null, msg?: string): asserts arg is [T] => {
    if (!is.arrayNotEmpty(arg)) error(msg ?? 'array has at least one element');
  },
  true: (arg: any, msg?: string): asserts arg is true => {
    if (!is.true(arg)) error(msg ?? 'must be true');
  },
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

export const precondition: { is: AssertType } = { is: assert };

export const postcondition: { is: AssertType } = { is: assert };

export const invariant: { is: AssertType } = { is: assert };
