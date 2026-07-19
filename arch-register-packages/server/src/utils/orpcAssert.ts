import { ORPCError } from '@orpc/server';
import { makeAssert, type AssertType } from './assertFactory';

type ORPCErrorCode = ConstructorParameters<typeof ORPCError>[0];
type ErrorInput = { code?: ORPCErrorCode; message?: string };

export const orpcAssert: AssertType<ErrorInput> = makeAssert<ErrorInput>((defaultMessage, err) => {
  throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
    message: err?.message ?? defaultMessage
  });
});
