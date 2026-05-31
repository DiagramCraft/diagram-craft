import { ErrorInput, HTTPError } from 'h3';

const STATUS_TEXTS: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found'
};

type AssertType = {
  /** Asserts that a value is a JSON object */
  json: <T = unknown>(arg: T, err?: ErrorInput) => asserts arg is NonNullable<T>;

  /** Asserts that a value is non-null and non-undefined */
  present: <T = unknown>(arg: T, err?: ErrorInput) => asserts arg is NonNullable<T>;

  /** Asserts that a value is exactly true */
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

export const httpAssert: AssertType = {
  json: <T = unknown>(o: T, err?: ErrorInput): asserts o is NonNullable<T> => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    if (o === null || o === undefined || typeof o !== 'object') {
      throw new HTTPError(
        err ?? { status: 400, message: 'Required value must be valid JSON object' }
      );
    }
  },

  present: <T = unknown>(o: T, err?: ErrorInput): asserts o is NonNullable<T> => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    if (o === null || o === undefined) {
      throw new HTTPError(err ?? { status: 400, message: 'Required value is missing' });
    }
  },

  array: <T = unknown>(
    o: T[] | ReadonlyArray<T> | undefined | null | unknown,
    err?: ErrorInput
  ): asserts o is T[] => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    if (o === null || o === undefined || !Array.isArray(o)) {
      throw new HTTPError(
        err ?? { status: 400, message: 'Required value is missing and not an array' }
      );
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  true: (o: any, err?: ErrorInput): asserts o is true => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    if (!o) {
      throw new HTTPError(err ?? { status: 400, message: 'Required value is missing' });
    }
  },

  string: (o: unknown, err?: ErrorInput): asserts o is string => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    if (typeof o !== 'string' || o === '') {
      throw new HTTPError(err ?? { status: 400, message: 'Required string is missing' });
    }
  },

  boolean: (o: unknown, err?: ErrorInput): asserts o is boolean => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    if (typeof o !== 'boolean') {
      throw new HTTPError(err ?? { status: 400, message: 'Required value must be a boolean' });
    }
  }
};
