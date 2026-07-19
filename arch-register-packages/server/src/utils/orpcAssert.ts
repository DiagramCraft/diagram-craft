import { ORPCError } from '@orpc/server';
import { makeAssert, type AssertType } from './assertFactory';
import type { ErrorMetadata } from './errorMetadata';

type ORPCErrorCode = ConstructorParameters<typeof ORPCError>[0];
type ErrorInput = { code?: ORPCErrorCode; message?: string; data?: ErrorMetadata };

export const orpcAssert: AssertType<ErrorInput> = makeAssert<ErrorInput>((defaultMessage, err) => {
  throw new ORPCError(err?.code ?? 'BAD_REQUEST', {
    message: err?.message ?? defaultMessage,
    data: err?.data
  });
});
