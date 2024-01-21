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

/**
 * DynamicAccessor class provides methods to get and set values of an object using a string path.
 *
 * @example
 * const accessor = new DynamicAccessor<MyType>();
 * const value = accessor.get(myObject, 'path.to.property');
 * accessor.set(myObject, 'path.to.property', newValue);
 */
export class DynamicAccessor<T> {
  constructor() {}

  /**
   * Gets the value of a property in an object using a string path.
   *
   * @param obj - The object to get the value from.
   * @param key - The string path to the property.
   * @returns The value of the property, or undefined if the property does not exist.
   */
  get<K extends PropPath<T> = PropPath<T>>(obj: T, key: K): PropPathValue<T, K> | undefined {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined) return undefined as PropPathValue<T, K>;
      current = current[part] as PropPathValue<T, K>;
    }
    return current;
  }

  /**
   * Sets the value of a property in an object using a string path.
   * If the property does not exist, it will be created.
   *
   * @param obj - The object to set the value in.
   * @param key - The string path to the property.
   * @param value - The value to set.
   */
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
