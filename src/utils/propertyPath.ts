/* eslint-disable @typescript-eslint/no-explicit-any */

type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false;

type PropPathImpl<T, Key extends keyof T> = Key extends string
  ? IsAny<T[Key]> extends true
    ? never
    : NonNullable<T[Key]> extends Record<string, any>
    ?
        | `${Key}.${PropPathImpl<
            NonNullable<T[Key]>,
            Exclude<keyof NonNullable<T[Key]>, keyof any[]>
          > &
            string}`
        | `${Key}.${Exclude<keyof NonNullable<T[Key]>, keyof any[]> & string}`
    : never
  : never;

type PropPathImpl2<T> = PropPathImpl<T, keyof T> | keyof T;

export type PropPath<T> = keyof T extends string
  ? PropPathImpl2<T> extends infer P
    ? P extends string | keyof T
      ? P
      : keyof T
    : keyof T
  : never;

export type PropPathValue<T, P extends PropPath<T>> = P extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? Rest extends PropPath<NonNullable<T[Key]>>
      ? PropPathValue<NonNullable<T[Key]>, Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

export class DynamicAccessor<T> {
  constructor() {}

  get<K extends PropPath<T> = PropPath<T>>(obj: T, key: K): PropPathValue<T, K> {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined) return undefined as PropPathValue<T, K>;
      current = current[part] as PropPathValue<T, K>;
    }
    return current;
  }

  set<K extends PropPath<T> = PropPath<T>>(obj: T, key: K, value: PropPathValue<T, K>): void {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] ??= {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
}
