import { deepClone } from './object';

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type DeepReadonly<T> = { +readonly [P in keyof T]: DeepReadonly<T[P]> };

export type DeepRequired<T> = { [P in keyof T]-?: DeepRequired<T[P]> };

export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

export const cloneAsWriteable: <T>(o: DeepReadonly<T>) => DeepWriteable<T> = deepClone;

export const makeWriteable = <T>(o: DeepReadonly<T>): DeepWriteable<T> => o as DeepWriteable<T>;

export const isEnum = <T extends string>(o: unknown, values: T[]): o is T => {
  return !(typeof o !== 'string' || !values.includes(o as T));
};

export type EmptyObject = Record<string, never>;
