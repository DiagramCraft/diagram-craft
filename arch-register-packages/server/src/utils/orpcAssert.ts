import { ORPCError } from '@orpc/server';

type ORPCErrorCode = ConstructorParameters<typeof ORPCError>[0];
type ErrorInput = { code?: ORPCErrorCode; message?: string };

type AssertType = {
  /** Asserts that a value is non-null and non-undefined */
  present: <T = unknown>(arg: T, err?: ErrorInput) => asserts arg is NonNullable<T>;

  /** Asserts that a value is exactly truthy */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  true: (arg: any, err?: ErrorInput) => asserts arg is true;

  /** Asserts that a value is a non-empty string */
  string: (arg: unknown, err?: ErrorInput) => asserts arg is string;

  /** Asserts that a value is a boolean */
  boolean: (arg: unknown, err?: ErrorInput) => asserts arg is boolean;

  /** Asserts that an array is non-empty */
  array: <T = unknown>(
    arg: T[] | ReadonlyArray<T> | undefined | null | unknown,
    err?: ErrorInput
  ) => asserts arg is T[];
};

export const orpcAssert: AssertType = {
  present: <T = unknown>(o: T, err?: ErrorInput): asserts o is NonNullable<T> => {
    if (o === null || o === undefined) {
      throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
        message: err?.message ?? 'Required value is missing'
      });
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  true: (o: any, err?: ErrorInput): asserts o is true => {
    if (!o) {
      throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
        message: err?.message ?? 'Required value is missing'
      });
    }
  },

  string: (o: unknown, err?: ErrorInput): asserts o is string => {
    if (typeof o !== 'string' || o === '') {
      throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
        message: err?.message ?? 'Required string is missing'
      });
    }
  },

  boolean: (o: unknown, err?: ErrorInput): asserts o is boolean => {
    if (typeof o !== 'boolean') {
      throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
        message: err?.message ?? 'Required value must be a boolean'
      });
    }
  },

  array: <T = unknown>(
    o: T[] | ReadonlyArray<T> | undefined | null | unknown,
    err?: ErrorInput
  ): asserts o is T[] => {
    if (o === null || o === undefined || !Array.isArray(o)) {
      throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
        message: err?.message ?? 'Required value must be an array'
      });
    }
  }
};
