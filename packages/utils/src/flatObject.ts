/**
 * Flat Object utilities for working with nested data structures as flat key-value maps.
 *
 * A "flat object" is a key-value representation where nested object hierarchies are
 * flattened into a single level using dot-notation paths. For example, instead of
 * storing `{user: {name: "John", address: {city: "NYC"}}}`, a flat object stores:
 * - `"user.name" => "John"`
 * - `"user.address.city" => "NYC"`
 *
 * The main purpose is for simple serialization and change tracking
 *
 * This module provides:
 * - {@link FlatObjectMapProxy}: A Proxy-based interface for accessing flat maps as nested objects
 * - {@link fromFlatObjectMap}: Utility to reconstruct nested objects from flat representations
 * - {@link FlatObject}: Type definition for simple flat object structures
 *
 * Arrays are supported through numeric indices (e.g., "items.0", "items.1") and are
 * automatically detected and reconstructed during access or conversion.
 *
 * @example
 * ```ts
 * // Create a flat map
 * const map = new Map([
 *   ['user.name', 'John'],
 *   ['user.settings.theme', 'dark'],
 *   ['items.0', 'first'],
 *   ['items.1', 'second']
 * ]);
 *
 * // Access as nested object using proxy
 * const proxy = FlatObjectMapProxy.create(DynamicValue.of(map));
 * console.log(proxy.user.name);  // "John"
 * console.log(proxy.items[0]);   // "first"
 *
 * // Or convert to nested structure
 * const nested = fromFlatObjectMap(map);
 * // { user: { name: "John", settings: { theme: "dark" } }, items: ["first", "second"] }
 * ```
 *
 * @module flatObject
 */
import { DeepReadonly } from './types';
import { DynamicValue } from './dynamicValue';
import { NOT_IMPLEMENTED_YET, VERIFY_NOT_REACHED } from './assert';
import { deepCloneOverride, isPrimitive } from './object';
import { unique } from './array';

/**
 * A Map-like interface supporting basic key-value operations.
 * Used to abstract over different map implementations for flat object storage.
 * @template V - The type of values stored in the map
 */
type MapLike<V> = {
  keys(): Iterable<string>;
  set(k: string, v: V | undefined): void;
  delete(k: string): void;
  has(k: string): boolean;
  get(k: string): V | undefined;
  entries(): Iterable<[string, V]>;
};

type DefaultValue = string | number | boolean | undefined;

/**
 * Represents an object with string keys and primitive values.
 * Useful for typing simple key-value objects.
 */
export type FlatObject = Record<string, DefaultValue>;

/**
 * Converts a flat map with dot-notation keys into a nested object structure.
 *
 * This function reconstructs a hierarchical object from a flat representation where
 * nested properties are encoded using dot notation (e.g., "user.name" becomes {user: {name: value}}).
 * It automatically detects and creates arrays when keys contain numeric indices.
 *
 * @template T - The expected type of the resulting nested object
 * @template V - The type of values in the flat map (defaults to DefaultValue)
 * @param map - A map-like object containing dot-notation keys and their values
 * @returns A deeply readonly nested object structure reconstructed from the flat map
 *
 * @example
 * ```ts
 * const map = new Map([
 *   ['user.name', 'John'],
 *   ['user.age', 30],
 *   ['tags.0', 'admin'],
 *   ['tags.1', 'user']
 * ]);
 * const obj = fromFlatObjectMap(map);
 * // Result: { user: { name: 'John', age: 30 }, tags: ['admin', 'user'] }
 * ```
 */
export const fromFlatObjectMap = <T, V = DefaultValue>(map: MapLike<V>) => {
  const result: Record<string, unknown> = {};

  for (const [path, value] of map.entries()) {
    const parts = path.split('.');
    let current = result;

    // Navigate through intermediate parts, creating structure as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;

      if (!(part in current)) {
        // Create array or object based on what the next part looks like
        const nextPart = parts[i + 1]!;
        current[part] = isNumeric(nextPart) ? [] : {};
      }

      current = current[part] as Record<string, unknown>;
    }

    // Set the leaf value
    const lastPart = parts.at(-1)!;
    if (value !== undefined) {
      current[lastPart] = value;
    } else if (!(lastPart in current)) {
      current[lastPart] = {};
    }
  }

  return result as DeepReadonly<T>;
};

const toJSONProp = 'toJSON';
const lengthProp = 'length';

// Check if all keys are numeric, and then we assume an array
const isArrayLike = (keys: Array<string | symbol>) =>
  keys.length > 0 && keys.every(k => isNumeric(k));

// Helper to check if a string represents a numeric array index
const isNumeric = (s: unknown): boolean => !Number.isNaN(Number(s));

/**
 * A Proxy handler that provides a nested object interface over a flat map structure.
 *
 * This class implements a JavaScript Proxy that allows accessing and modifying flat map data
 * (with dot-notation keys) as if it were a nested object structure. It handles both object
 * and array access patterns, automatically detecting and creating the appropriate structure
 * based on key patterns.
 *
 * The proxy is lazy - nested objects are only created when accessed, and changes are
 * written back to the underlying flat map structure.
 *
 * @template T - The type of the proxied object
 * @template V - The type of values stored in the flat map (defaults to DefaultValue)
 *
 * @example
 * ```ts
 * const map = new Map();
 * const proxy = FlatObjectMapProxy.create<{user: {name: string, age: number}}>(DynamicValue.of(map));
 * proxy.user.name = 'John';  // Sets map key "user.name" to "John"
 * proxy.user.age = 30;       // Sets map key "user.age" to 30
 * console.log(proxy.user.name);  // Reads from map key "user.name" -> "John"
 * console.log(map);  // Map { "user.name" => "John", "user.age" => 30 }
 * ```
 */
export class FlatObjectMapProxy<T extends object, V = DefaultValue> implements ProxyHandler<T> {
  readonly #isTopLevel: boolean;

  protected constructor(
    private readonly obj: DynamicValue<MapLike<V>>,
    private readonly path: string
  ) {
    this.#isTopLevel = path === '';
  }

  /**
   * Creates a new proxy instance over a flat map structure.
   *
   * @template T - The expected type of the proxied object
   * @template V - The type of values in the flat map (defaults to DefaultValue)
   * @param obj - A DynamicValue wrapping the map-like object to proxy
   * @returns A proxy object that provides nested access to the flat map
   */
  static create<T extends object, V = DefaultValue>(obj: DynamicValue<MapLike<V>>): T {
    return new Proxy<T>({} as unknown as T, new FlatObjectMapProxy(obj, ''));
  }

  /**
   * Proxy trap for getting property descriptors.
   * Returns appropriate descriptors for enumerable properties and special cases like length.
   */
  getOwnPropertyDescriptor(_target: T, prop: string | symbol): PropertyDescriptor | undefined {
    if (this.#isTopLevel && (prop === toJSONProp || prop === deepCloneOverride)) {
      return undefined;
    } else if (prop === lengthProp) {
      return { writable: true, enumerable: false, configurable: false };
    } else {
      return { enumerable: true, configurable: true, writable: true };
    }
  }

  /**
   * Proxy trap for enumerating object keys.
   * Returns all unique property names at the current nesting level in the flat map.
   * For array-like objects, includes a 'length' property.
   */
  ownKeys(_target: T): ArrayLike<string | symbol> {
    const keys = this.getKeys();

    if (isArrayLike(keys)) {
      keys.push(lengthProp);
    }

    if (this.#isTopLevel) {
      keys.push(toJSONProp);
      keys.push(deepCloneOverride);
    }

    return keys;
  }

  /**
   * Proxy trap for getting property values.
   * Retrieves values from the flat map using dot-notation paths.
   * Automatically creates sub-proxies for nested objects and handles array-like structures.
   */
  get(target: T, prop: string | symbol): unknown {
    const propKey = prop as keyof typeof target;

    // Handle top level special methods to support JSON and cloning
    if (this.#isTopLevel && (prop === toJSONProp || prop === deepCloneOverride)) {
      return () => fromFlatObjectMap(this.obj.get());
    }

    // Handle iterator and length property for arrays
    if (prop === Symbol.iterator) {
      return Array.isArray(target) ? target[Symbol.iterator] : undefined;
    }

    if (prop === lengthProp) {
      const arrayKeys = this.getKeys().filter(k => !Number.isNaN(Number(k)));
      if (arrayKeys.length === 0) return 0;
      return Math.max(...arrayKeys.map(Number)) + 1;
    }

    // Handle to string
    if (prop === Symbol.toStringTag) {
      return target[propKey];
    }

    // Check if there's a value for the property as is on the target
    if (target[propKey] !== undefined) {
      return target[propKey];
    }

    // At this point, no additional symbol properties are implements
    // Unclear if any such properties exists
    if (typeof prop !== 'string') {
      return NOT_IMPLEMENTED_YET();
    }

    const map = this.obj.get();

    const fullPath = this.buildFullPath(prop);
    const value = map.get(fullPath);

    if (value === undefined) {
      if (map.has(fullPath)) return this.subProxy(fullPath);

      const keys = this.getKeysWithPrefix(`${fullPath}.`);
      if (keys.length === 0) {
        return undefined;
      }

      const numericKeys = keys.map(k => Number(k.substring(fullPath.length + 1).split('.')[0]));
      if (!numericKeys.some(Number.isNaN)) {
        return this.subProxy(
          fullPath,
          unique(numericKeys.sort((a, b) => a - b)).map(key => this.subProxy(`${fullPath}.${key}`))
        );
      } else {
        return this.subProxy(fullPath);
      }
    } else if (isPrimitive(value)) {
      return value;
    }

    return this.subProxy(fullPath);
  }

  /**
   * Proxy trap for setting property values.
   * Writes values to the flat map using dot-notation paths.
   * When setting nested objects, recursively flattens them into dot-notation keys.
   * Setting a value to undefined removes the key and all nested keys from the map.
   */
  set(_target: T, prop: string | symbol, value: unknown): boolean {
    if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

    const fullPath = this.buildFullPath(prop);

    const map = this.obj.get();

    if (value === undefined) {
      map.delete(fullPath);
      this.deleteKeysWithPrefix(`${fullPath}.`);
    } else {
      if (isPrimitive(value)) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        map.set(fullPath, value as any);
      } else if (value instanceof Object && Object.keys(value).length === 0) {
        map.set(fullPath, undefined);
      } else {
        // First, remove all existing nested properties under this path
        this.deleteKeysWithPrefix(`${fullPath}.`);
        this.setNestedValuesRecursively(value, fullPath);
      }
    }
    return true;
  }

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  private setNestedValuesRecursively(value: any, basePath: string): void {
    if (isPrimitive(value)) {
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      this.obj.get().set(basePath, value as any);
    } else if (value !== null && typeof value === 'object') {
      for (const key in value) {
        const nextPath = `${basePath}.${key}`;
        this.setNestedValuesRecursively(value[key], nextPath);
      }
    }
  }

  private getKeys() {
    const prefix = `${this.path}.`;
    return unique(
      Array.from(this.obj.get().keys())
        .filter(k => this.#isTopLevel || k.startsWith(prefix))
        .map(k => (this.#isTopLevel ? k : k.substring(prefix.length)))
        .map(k => k.split('.')[0]!)
    );
  }

  /**
   * Creates a sub-proxy for a nested path in the flat map.
   */
  private subProxy(path: string, target = {}) {
    return new Proxy<T>(target as unknown as T, new FlatObjectMapProxy(this.obj, path));
  }

  /**
   * Constructs the full path for a property by combining the current path with the property name.
   */
  private buildFullPath(prop: string): string {
    return this.#isTopLevel ? prop : `${this.path}.${prop}`;
  }

  /**
   * Returns all keys from the map that start with the given prefix.
   */
  private getKeysWithPrefix(prefix: string): string[] {
    return Array.from(this.obj.get().keys()).filter(k => k.startsWith(prefix));
  }

  /**
   * Deletes all keys from the map that start with the given prefix.
   */
  private deleteKeysWithPrefix(prefix: string): void {
    const map = this.obj.get();
    for (const k of this.getKeysWithPrefix(prefix)) {
      map.delete(k);
    }
  }
}
