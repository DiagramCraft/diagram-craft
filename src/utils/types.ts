export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export type DeepReadonly<T> = { +readonly [P in keyof T]: DeepReadonly<T[P]> };

export type DeepRequired<T> = { [P in keyof T]-?: DeepRequired<T[P]> };

export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
