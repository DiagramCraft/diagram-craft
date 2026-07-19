export interface AssertMessages {
  json: string;
  present: string;
  true: string;
  string: string;
  boolean: string;
  array: string;
}

const DEFAULT_MESSAGES: AssertMessages = {
  json: 'Required value must be valid JSON object',
  present: 'Required value is missing',
  true: 'Required value is missing',
  string: 'Required string is missing',
  boolean: 'Required value must be a boolean',
  array: 'Required value must be an array'
};

export interface AssertType<E> {
  /** Asserts that a value is a JSON object */
  json: <T = unknown>(arg: T, err?: E) => asserts arg is NonNullable<T>;

  /** Asserts that a value is non-null and non-undefined */
  present: <T = unknown>(arg: T, err?: E) => asserts arg is NonNullable<T>;

  /** Asserts that a value is exactly true */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  true: (arg: any, err?: E) => asserts arg is true;

  /** Asserts that a value is a non-empty string */
  string: (arg: unknown, err?: E) => asserts arg is string;

  /** Asserts that a value is a boolean */
  boolean: (arg: unknown, err?: E) => asserts arg is boolean;

  /** Asserts that a value is an array */
  array: <T = unknown>(
    arg: T[] | ReadonlyArray<T> | undefined | null | unknown,
    err?: E
  ) => asserts arg is T[];
}

export const makeAssert = <E>(
  throwError: (defaultMessage: string, err?: E) => never,
  messageOverrides: Partial<AssertMessages> = {}
): AssertType<E> => {
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides };

  return {
    json: <T = unknown>(arg: T, err?: E): asserts arg is NonNullable<T> => {
      if (arg === null || arg === undefined || typeof arg !== 'object') {
        throwError(messages.json, err);
      }
    },

    present: <T = unknown>(arg: T, err?: E): asserts arg is NonNullable<T> => {
      if (arg === null || arg === undefined) {
        throwError(messages.present, err);
      }
    },

    // biome-ignore lint/suspicious/noExplicitAny: false positive
    true: (arg: any, err?: E): asserts arg is true => {
      if (!arg) {
        throwError(messages.true, err);
      }
    },

    string: (arg: unknown, err?: E): asserts arg is string => {
      if (typeof arg !== 'string' || arg === '') {
        throwError(messages.string, err);
      }
    },

    boolean: (arg: unknown, err?: E): asserts arg is boolean => {
      if (typeof arg !== 'boolean') {
        throwError(messages.boolean, err);
      }
    },

    array: <T = unknown>(
      arg: T[] | ReadonlyArray<T> | undefined | null | unknown,
      err?: E
    ): asserts arg is T[] => {
      if (arg === null || arg === undefined || !Array.isArray(arg)) {
        throwError(messages.array, err);
      }
    }
  };
};
