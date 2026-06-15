import { httpAssert } from './httpAssert';

export const PUBLIC_ID_PREFIX_PATTERN = /^[A-Z]{2,5}$/;

export const normalizePublicIdPrefix = (value: string) => value.trim().toUpperCase();

export const validatePublicIdPrefix = (
  rawValue: unknown,
  fieldName: string,
  opts?: { optional?: boolean }
): string | undefined => {
  if (rawValue === undefined && opts?.optional) return undefined;
  httpAssert.string(rawValue, { message: `${fieldName} is required` });
  const normalized = normalizePublicIdPrefix(rawValue);
  httpAssert.true(PUBLIC_ID_PREFIX_PATTERN.test(normalized), {
    message: `${fieldName} must be 2-5 uppercase letters`
  });
  return normalized;
};

export const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const formatPublicId = (prefix: string, sequenceNumber: number) =>
  `${prefix}-${sequenceNumber}`;
