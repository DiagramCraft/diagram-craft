/**
 * Structural subset of a zod schema's `safeParse` - avoids web depending on the `zod` package
 * directly (only api-types does); any zod object schema satisfies this shape.
 */
type SafeParseable<T> = {
  safeParse: (raw: unknown) => { success: true; data: T } | { success: false };
};

/**
 * Parses `raw` against `schema`; on success, merges the parsed result over `defaults`
 * field-by-field (parsed value wins per-field when present, default fills gaps). On parse
 * failure, returns `defaults` unchanged. `defaults` must be supplied explicitly rather than
 * relying on zod `.default()` since the view-config schemas don't uniformly carry complete
 * defaults for every field.
 */
export const normalizeViewConfig = <T extends Record<string, unknown>>(
  schema: SafeParseable<T>,
  raw: unknown,
  defaults: T
): T => {
  const result = schema.safeParse(raw);
  if (!result.success) return defaults;
  const parsed = result.data as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (parsed[key] !== undefined) merged[key] = parsed[key];
  }
  return merged as T;
};
