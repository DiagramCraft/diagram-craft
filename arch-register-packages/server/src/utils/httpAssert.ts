import { HTTPError } from 'h3';
import type { ErrorInput } from 'h3';
import { makeAssert, type AssertType } from './assertFactory';
import type { ErrorMetadata } from './errorMetadata';

const STATUS_TEXTS: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict'
};

export const httpAssert: AssertType<ErrorInput<ErrorMetadata>> = makeAssert<
  ErrorInput<ErrorMetadata>
>(
  (defaultMessage, err) => {
    if (err) err.status ??= 400;
    if (err?.status) err.statusText ??= STATUS_TEXTS[err.status];
    throw new HTTPError(err ?? { status: 400, message: defaultMessage });
  },
  { array: 'Required value is missing and not an array' }
);
