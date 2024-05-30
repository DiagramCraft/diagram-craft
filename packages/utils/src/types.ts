export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type DeepReadonly<T> = { +readonly [P in keyof T]: DeepReadonly<T[P]> };

export type DeepRequired<T> = { [P in keyof T]-?: DeepRequired<T[P]> };

export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

export const writeable = <T>(o: DeepReadonly<T>): DeepWriteable<T> => o as DeepWriteable<T>;

/* Tagged type *********************************************************************************** */

export type TaggedType<T extends string, V> = { _type: T; _val: V };

export const isTaggedType = <T extends string, V>(o: unknown, type: T): o is TaggedType<T, V> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (o as any)?._type === type;

export const tag = <T extends string>(type: T, val: unknown): TaggedType<T, unknown> => ({
  _type: type,
  _val: val
});
