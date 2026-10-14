import type { z } from 'zod';

/** The `isValidConfig` of a component whose config is described by a zod object schema. */
export const schemaGuard =
  <S extends z.ZodType<Record<string, unknown>>>(schema: S) =>
  (config: Record<string, unknown>): config is z.infer<S> =>
    schema.safeParse(config).success;

/**
 * Parses `input` field by field, falling back to the matching default for any field that is
 * missing or invalid. This keeps authored content readable when one attribute has gone stale,
 * where a strict `schema.parse` would reject the whole config.
 */
export const parseConfigFields = <Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  input: unknown,
  defaults: z.infer<z.ZodObject<Shape>>
): z.infer<z.ZodObject<Shape>> => {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const defaultValues = defaults as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => {
      const result = (field as z.ZodType).safeParse(source[key]);
      return [key, result.success && result.data !== undefined ? result.data : defaultValues[key]];
    })
  ) as z.infer<z.ZodObject<Shape>>;
};

const toBase64Url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** Serializes a config into the single MDX attribute value used by the embed components. */
export const encodeConfigAttribute = (payload: unknown): string =>
  toBase64Url(JSON.stringify(payload));

/** Reverses `encodeConfigAttribute`; returns `null` for empty or malformed values. */
export const decodeConfigAttribute = (raw: string | undefined): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};
