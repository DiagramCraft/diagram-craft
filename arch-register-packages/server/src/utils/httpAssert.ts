import { ErrorDetails, HTTPError } from 'h3';

export const httpAssert = {
  present: <T = unknown>(o: T, err?: ErrorDetails): o is NonNullable<T> => {
    if (o === null || o === undefined) {
      throw new HTTPError(err ?? { status: 400, message: 'Required value is missing' });
    }
    return true;
  },

  true: <T = unknown>(o: T, err?: ErrorDetails): o is NonNullable<T> => {
    if (o) {
      return true;
    }
    throw new HTTPError(err ?? { status: 400, message: 'Required value is missing' });
  }
};
