/**
 *
 * Assertion utilities for runtime checks, preconditions, and invariants.
 *
 * Provides type-safe assertion functions that throw errors when conditions fail
 * and narrow TypeScript types when they succeed.
 *
 * @example Basic assertions
 * ```ts
 * import { assert } from '@diagram-craft/utils/assert';
 *
 * function processUser(user: User | undefined) {
 *   assert.present(user, 'User must be defined');
 *   // TypeScript now knows user is non-null
 *   console.log(user.name);
 * }
 * ```
 *
 * @example Preconditions and invariants
 * ```ts
 * import { precondition, invariant } from '@diagram-craft/utils/assert';
 *
 * function divide(a: number, b: number) {
 *   precondition.is.false(b === 0, 'Cannot divide by zero');
 *   const result = a / b;
 *   invariant.is.true(isFinite(result), 'Result must be finite');
 *   return result;
 * }
 * ```
 *
 * @example Array checks
 * ```ts
 * import { assert } from '@diagram-craft/utils/assert';
 *
 * function getFirst<T>(items: T[] | undefined) {
 *   assert.arrayNotEmpty(items);
 *   // TypeScript knows items is [T, ...T[]]
 *   return items[0];
 * }
 * ```
 *
 * @module
 */

/**
 * Error thrown when code reaches a point that should be unreachable.
 *
 * Use this to mark code paths that should never execute, such as exhaustive
 * switch statements or defensive checks for impossible states.
 *
 * @group Exceptions
 */
export class VerifyNotReached extends Error {
  constructor(msg?: string) {
    super(`Should not be reached ${msg ?? ''}`);
  }
}

/** @internal */
export class NotImplementedYet extends Error {
  constructor(msg?: string) {
    super(`Not implemented yet ${msg ?? ''}`);
  }
}

/**
 * Throws a VerifyNotReached error to indicate unreachable code.
 *
 * @param s - Optional message to include in the error
 * @throws {VerifyNotReached} Always throws
 *
 * @example
 * ```ts
 * function handleState(state: 'active' | 'inactive') {
 *   switch (state) {
 *     case 'active': return true;
 *     case 'inactive': return false;
 *     default: VERIFY_NOT_REACHED(`Unexpected state: ${state}`);
 *   }
 * }
 * ```
 *
 * @group Assertions
 */
export function VERIFY_NOT_REACHED(s?: string): never {
  throw new VerifyNotReached(s);
}

/** @internal */
export function NOT_IMPLEMENTED_YET(): never {
  throw new NotImplementedYet();
}

/**
 * Type guard functions for conditional checks without throwing errors.
 *
 * These functions return boolean values and narrow TypeScript types when used
 * in conditional statements. Use these for non-throwing checks, and use the
 * `assert` functions when you want to throw on failure.
 *
 * @namespace
 * @group Conditions
 */
export const is = {
  /** Checks if a value is non-null and non-undefined */
  present: <T = unknown>(arg: T): arg is NonNullable<T> => arg !== null && arg !== undefined,

  /** Checks if a value is null or undefined */
  notPresent: <T = unknown>(arg: T | undefined): arg is undefined =>
    arg === null || arg === undefined,

  /** Checks if the argument is an array with exactly one element */
  arrayWithExactlyOneElement: (arg: unknown) =>
    is.present(arg) && Array.isArray(arg) && arg.length === 1,

  /** Checks if the argument is a non-empty array */
  arrayNotEmpty: <T = unknown>(
    arg: T[] | ReadonlyArray<T> | undefined | null
  ): arg is [T, ...T[]] => is.present(arg) && Array.isArray(arg) && arg.length >= 1,

  /** Checks if a value is exactly true */
  true: (arg: unknown) => arg === true,

  /** Checks if a value is exactly false */
  false: (arg: unknown) => arg === false
};

/**
 * Type definition for assertion functions that throw errors on failure
 * and narrow TypeScript types on success.
 */
type AssertType = {
  /** Asserts that a value is non-null and non-undefined */
  present: <T = unknown>(arg: T, msg?: string) => asserts arg is NonNullable<T>;

  /** Asserts that a value is null or undefined */
  notPresent: <T = unknown>(arg: T | undefined, msg?: string) => asserts arg is undefined;

  /** Asserts that an array has exactly one element */
  arrayWithExactlyOneElement: <T = unknown>(
    arg: readonly T[] | T[] | undefined | null,
    msg?: string
  ) => asserts arg is [T];

  /** Asserts that an array is non-empty */
  arrayNotEmpty: <T = unknown>(
    arg: T[] | ReadonlyArray<T> | undefined | null,
    msg?: string
  ) => asserts arg is [T, ...T[]];

  /** Asserts that a value is exactly true */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  true: (arg: any, msg?: string) => asserts arg is true;

  /** Asserts that a value is exactly false */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  false: (arg: any, msg?: string) => asserts arg is false;

  /** Always fails with an error */
  fail: (msg?: string) => never;
};

/**
 * Global interface for extending AssertType with custom assertion methods.
 *
 * To add custom assertions, extend this interface using declaration merging:
 *
 * @example
 * ```ts
 * declare global {
 *   namespace DiagramCraft {
 *     interface AssertTypeExtensions {
 *       isPositive: (arg: number, msg?: string) => asserts arg is number;
 *     }
 *   }
 * }
 * ```
 */
declare global {
  namespace DiagramCraft {
    interface AssertTypeExtensions {}
  }
}

const makeAssertions = (
  error: (m: string) => never
): AssertType & DiagramCraft.AssertTypeExtensions => ({
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
  arrayNotEmpty: <T = unknown>(
    arg: T[] | ReadonlyArray<T> | undefined | null,
    msg?: string
  ): asserts arg is [T, ...T[]] => {
    if (!is.arrayNotEmpty(arg)) error(msg ?? 'array has at least one element');
  },
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  true: (arg: any, msg?: string): asserts arg is true => {
    if (!is.true(arg)) error(msg ?? 'must be true');
  },
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  false: (arg: any, msg?: string): asserts arg is false => {
    if (!is.false(arg)) error(msg ?? 'must be false');
  },
  fail: (msg?: string) => {
    error(msg ?? 'fail');
  },
  ...({} as DiagramCraft.AssertTypeExtensions)
});

/**
 * General-purpose assertion functions that throw Error on failure.
 *
 * Use these for validating runtime conditions and narrowing TypeScript types.
 * When assertions fail, a generic Error is thrown.
 *
 * @example
 * ```ts
 * function process(data: unknown) {
 *   assert.present(data, 'Data is required');
 *   assert.true(typeof data === 'object', 'Data must be an object');
 *   // data is now NonNullable<unknown>
 * }
 * ```
 *
 * @group Assertions
 */
export const assert: AssertType & DiagramCraft.AssertTypeExtensions = makeAssertions(m => {
  throw new Error(m);
});

/** @internal */
export const notImplemented: AssertType & DiagramCraft.AssertTypeExtensions = makeAssertions(m => {
  throw new NotImplementedYet(m);
});

/**
 * Precondition assertions for validating function inputs and initial state.
 *
 * Use these at the beginning of functions to validate arguments and preconditions
 * before executing the main logic. Semantically indicates input validation.
 *
 * @example
 * ```ts
 * function withdraw(amount: number, balance: number) {
 *   precondition.is.true(amount > 0, 'Amount must be positive');
 *   precondition.is.true(balance >= amount, 'Insufficient funds');
 *   return balance - amount;
 * }
 * ```
 *
 * @group Assertions
 */
export const precondition: { is: AssertType & DiagramCraft.AssertTypeExtensions } = { is: assert };

/**
 * Postcondition assertions for validating function outputs and final state.
 *
 * Use these at the end of functions to validate return values and ensure the
 * function has achieved its expected outcome. Semantically indicates output validation.
 *
 * @example
 * ```ts
 * function calculateDiscount(price: number, rate: number): number {
 *   const discount = price * rate;
 *   postcondition.is.true(discount >= 0, 'Discount cannot be negative');
 *   postcondition.is.true(discount <= price, 'Discount cannot exceed price');
 *   return discount;
 * }
 * ```
 *
 * @group Assertions
 */
export const postcondition: { is: AssertType & DiagramCraft.AssertTypeExtensions } = { is: assert };

/**
 * Invariant assertions for validating internal state that must always be true.
 *
 * Use these to check conditions that should never be violated during execution,
 * regardless of inputs. Semantically indicates internal consistency checks.
 *
 * @example
 * ```ts
 * class BankAccount {
 *   private balance = 0;
 *
 *   withdraw(amount: number) {
 *     this.balance -= amount;
 *     invariant.is.true(this.balance >= 0, 'Balance invariant violated');
 *   }
 * }
 * ```
 *
 * @group Assertions
 */
export const invariant: { is: AssertType & DiagramCraft.AssertTypeExtensions } = { is: assert };

/**
 * Ensures that the provided argument is defined and not undefined.
 *
 * If the argument is undefined, an exception is thrown. Otherwise, the function
 * returns the argument as is. This function is useful for enforcing type safety
 * by guaranteeing the existence of a value at runtime.
 *
 * @param {T | undefined} arg - The value to check for existence.
 * @throws {VerifyNotReached} Throws an error if the argument is undefined.
 * @returns {T} The provided argument, guaranteed to be defined.
 *
 * @group Assertions
 */
export const mustExist = <T>(arg: T | undefined): T => {
  if (is.notPresent(arg)) {
    throw new VerifyNotReached();
  }
  return arg;
};
