import { z } from 'zod';

declare module 'zod' {
  interface GlobalMeta {
    /** The value a new instance of a component starts with for this config field. */
    initial?: unknown;
  }
}

/**
 * Declares the value a new instance of the component starts with for this field. It has no effect
 * on validation: a placeholder such as `''` for a required selection stays invalid until the user
 * picks something. Pass a function for values that must be generated per instance (ids).
 *
 * Wraps the whole field expression because `.meta()` must be the last call in the chain: wrappers
 * such as `.optional()` applied afterwards would not carry it.
 */
export const withInitial = <S extends z.ZodType>(
  schema: S,
  value: z.input<S> | (() => z.input<S>)
): S => schema.meta({ initial: value });

/** The starting config a schema declares through `withInitial`. */
export const initialConfigOf = (schema: z.ZodType): Record<string, unknown> => {
  const shape = (schema as unknown as { shape?: Record<string, z.ZodType> }).shape ?? {};
  return Object.fromEntries(
    Object.entries(shape).flatMap(([key, field]) => {
      const meta = z.globalRegistry.get(field);
      if (!meta || !('initial' in meta)) return [];
      const { initial } = meta;
      // Cloned so that instances never share one array or object.
      return [[key, typeof initial === 'function' ? initial() : structuredClone(initial)]];
    })
  );
};

/** Config of a widget without options of its own; any stored keys are ignored. */
export const noOptionsConfigSchema = z.object({});

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

type ObjectSchema = z.ZodObject<z.ZodRawShape>;

/**
 * How a component's config is written to and read from the string fields of its editor element
 * (which are also its MDX attributes). `keys` are the element field names.
 */
export type ConfigCodec = {
  keys: ReadonlyArray<string>;
  /** MDX attribute names that differ from the element field name (`id` clashes with Plate's). */
  attributeNames: Readonly<Record<string, string>>;
  decode: (
    fields: Record<string, string>,
    defaults: Record<string, unknown>
  ) => Record<string, unknown>;
  /** Every key is present in the result ('' when unset) so a node update clears stale values. */
  encode: (config: Record<string, unknown>) => Record<string, string>;
};

type ZodDef = { type: string; innerType?: { _zod: { def: ZodDef } } };

const WRAPPER_TYPES = ['optional', 'nullable', 'default', 'prefault', 'catch'];

/** The value type of a field, looking through optional/default wrappers. */
const fieldKind = (field: z.ZodType): string => {
  let def = (field as unknown as { _zod: { def: ZodDef } })._zod.def;
  while (def.innerType && WRAPPER_TYPES.includes(def.type)) def = def.innerType._zod.def;
  return def.type;
};

const fromAttribute = (field: z.ZodType, raw: string | undefined): unknown => {
  if (raw === undefined || raw === '') return undefined;
  const kind = fieldKind(field);
  if (kind === 'number') return Number(raw);
  if (kind === 'boolean') return raw !== 'false';
  return raw;
};

/**
 * Codec for a config of scalar fields, each stored as its own attribute. Numbers and booleans are
 * coerced according to the schema; anything missing or invalid falls back to the default.
 */
export const flatConfigCodec = (
  schema: ObjectSchema,
  options: {
    attributeNames?: Record<string, string>;
    /** Final clean-up of a decoded config, for rules a field schema can't express. */
    normalize?: (config: Record<string, unknown>) => Record<string, unknown>;
  } = {}
): ConfigCodec => {
  const keys = Object.keys(schema.shape);
  return {
    keys,
    attributeNames: options.attributeNames ?? {},
    decode: (fields, defaults) => {
      const input = Object.fromEntries(
        keys.map(key => [key, fromAttribute(schema.shape[key] as z.ZodType, fields[key])])
      );
      const config = parseConfigFields(schema, input, defaults);
      return options.normalize ? options.normalize(config) : config;
    },
    encode: config =>
      Object.fromEntries(
        keys.map(key => {
          const value = config[key];
          return [key, value === undefined || value === null ? '' : String(value)];
        })
      )
  };
};

/**
 * Codec for a config of nested values, stored as one base64 JSON `config` attribute so the MDX
 * stays compact. `preDecode` and `postEncode` adapt values that are persisted differently from
 * their in-memory shape.
 */
export const createBlobConfigCodec = <Schema extends ObjectSchema>(
  schema: Schema,
  hooks: {
    preDecode?: (payload: Record<string, unknown>) => Record<string, unknown>;
    postEncode?: (config: z.infer<Schema>) => unknown;
  } = {}
) => {
  type Config = z.infer<Schema>;
  const createDefault = (): Config => initialConfigOf(schema) as Config;
  const encode = (config: Config): string =>
    encodeConfigAttribute(hooks.postEncode ? hooks.postEncode(config) : config);
  /** `null` when `raw` holds no config at all. */
  const decode = (raw: string | undefined, defaults: Config = createDefault()): Config | null => {
    const payload = decodeConfigAttribute(raw);
    if (!payload) return null;
    const input = hooks.preDecode ? hooks.preDecode(payload) : payload;
    return parseConfigFields(schema, input, defaults) as Config;
  };
  const codec: ConfigCodec = {
    keys: ['config'],
    attributeNames: {},
    decode: (fields, defaults) => decode(fields.config, defaults as Config) ?? defaults,
    encode: config => ({ config: encode(config as Config) })
  };
  return { createDefault, encode, decode, codec };
};
