export type SearchParamCodec<T> = {
  readonly decode: (value: unknown) => T | undefined;
};

type AnySearchParamCodec = SearchParamCodec<unknown>;

export type SearchParamSchema = Record<string, AnySearchParamCodec>;

export type SearchParamCodecOutput<TCodec> =
  TCodec extends SearchParamCodec<infer TValue> ? TValue : never;

export type SearchParamsFromSchema<TSchema extends SearchParamSchema> = {
  -readonly [K in keyof TSchema]?: SearchParamCodecOutput<TSchema[K]>;
};

export const defineSearchParamCodec = <T>(
  decode: SearchParamCodec<T>['decode']
): SearchParamCodec<T> => ({ decode });

export const defineSearchParamSchema = <const TSchema extends SearchParamSchema>(
  schema: TSchema
): TSchema => schema;

export const parseSearchParams = <const TSchema extends SearchParamSchema>(
  schema: TSchema,
  raw: Record<string, unknown>
): SearchParamsFromSchema<TSchema> => {
  const parsed = {} as SearchParamsFromSchema<TSchema>;

  for (const [key, codec] of Object.entries(schema)) {
    (parsed as Record<string, unknown>)[key] = codec.decode(raw[key]);
  }

  return parsed;
};

export const stringCodec = defineSearchParamCodec(value =>
  typeof value === 'string' ? value : undefined
);

export const enumCodec = <const TValues extends readonly string[]>(
  values: TValues
): SearchParamCodec<TValues[number]> =>
  defineSearchParamCodec(value =>
    typeof value === 'string' && values.some(candidate => candidate === value)
      ? (value as TValues[number])
      : undefined
  );

export const mapCodec = <TInput, TOutput>(
  codec: SearchParamCodec<TInput>,
  map: (value: TInput) => TOutput
): SearchParamCodec<TOutput> =>
  defineSearchParamCodec(value => {
    const decoded = codec.decode(value);
    return decoded === undefined ? undefined : map(decoded);
  });

export const omitDefaultCodec = <T, const TDefault extends T>(
  codec: SearchParamCodec<T>,
  defaultValue: TDefault
): SearchParamCodec<Exclude<T, TDefault>> =>
  defineSearchParamCodec(value => {
    const decoded = codec.decode(value);
    return decoded === undefined || decoded === defaultValue
      ? undefined
      : (decoded as Exclude<T, TDefault>);
  });

export type NumberInRangeOptions = {
  min: number;
  max: number;
  defaultValue?: number;
  integer?: boolean;
};

export const numberInRangeCodec = ({
  min,
  max,
  defaultValue,
  integer = false
}: NumberInRangeOptions): SearchParamCodec<number> =>
  defineSearchParamCodec(value => {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : NaN;

    if (!Number.isFinite(parsed)) return undefined;
    if (integer && !Number.isInteger(parsed)) return undefined;
    if (parsed < min || parsed > max) return undefined;
    return parsed === defaultValue ? undefined : parsed;
  });

export const positivePageCodec = defineSearchParamCodec(value => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const page = Number(value);
    return Number.isSafeInteger(page) && page > 0 ? page : undefined;
  }

  return undefined;
});
