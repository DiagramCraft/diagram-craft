import type { DataWithSchema } from '../dataProvider';
import type { DataSchema, DataSchemaField } from '../diagramDocumentDataSchemas';
import { isObj } from '@diagram-craft/utils/object';
import { assert } from '@diagram-craft/utils/assert';

export type RequestCacheMode =
  | 'default'
  | 'force-cache'
  | 'no-cache'
  | 'no-store'
  | 'only-if-cached'
  | 'reload';

export type RequestInitWithCache = RequestInit & {
  cache?: RequestCacheMode;
};

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
}

function assertDataSchemaField(value: unknown): asserts value is DataSchemaField {
  assert.true(isObj(value));

  const field = value as Record<string, unknown>;
  assertString(field.id, 'Schema field id');
  assertString(field.name, 'Schema field name');
  assertString(field.type, 'Schema field type');

  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'boolean':
      return;
    case 'select':
      if (!Array.isArray(field.options)) {
        throw new Error('Select field options must be an array');
      }
      for (const option of field.options) {
        if (!isObj(option)) {
          throw new Error('Select field option must be an object');
        }
        const typedOption = option as Record<string, unknown>;
        assertString(typedOption.value, 'Select field option value');
        assertString(typedOption.label, 'Select field option label');
      }
      return;
    case 'reference':
    case 'containment':
      assertString(field.schemaId, 'Relationship field schemaId');
      if (typeof field.minCount !== 'number') {
        throw new Error('Relationship field minCount must be a number');
      }
      if (typeof field.maxCount !== 'number') {
        throw new Error('Relationship field maxCount must be a number');
      }
      return;
    default:
      throw new Error(`Unsupported schema field type: ${String(field.type)}`);
  }
}

export function assertDataSchema(value: unknown): asserts value is DataSchema {
  assert.true(isObj(value));

  const schema = value as Record<string, unknown>;
  assertString(schema.id, 'Schema id');
  assertString(schema.name, 'Schema name');
  // providerId is optional during fetch - it gets set by the data provider after fetching
  if (schema.providerId !== undefined) {
    assertString(schema.providerId, 'Schema providerId');
  }
  if (!Array.isArray(schema.fields)) {
    throw new Error('Schema fields must be an array');
  }
  schema.fields.forEach(assertDataSchemaField);
}

export function assertDataWithSchema(value: unknown): asserts value is DataWithSchema {
  assert.true(isObj(value));

  const data = value as Record<string, unknown>;
  assertString(data._uid, 'Data entry _uid');
  assertString(data._schemaId, 'Data entry _schemaId');

  for (const [key, fieldValue] of Object.entries(data)) {
    if (typeof fieldValue !== 'string') {
      throw new Error(`Data entry field "${key}" must be a string`);
    }
  }
}

export const readJson = async <T>(
  response: Response,
  assertValid: (value: unknown) => asserts value is T
): Promise<T> => {
  const json = await response.json();
  assertValid(json);
  return json;
};

export const readJsonArray = async <T>(
  response: Response,
  assertValid: (value: unknown) => asserts value is T
): Promise<T[]> => {
  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error('Response must be an array');
  }
  json.forEach(assertValid);
  return json as T[];
};

export const withCacheMode = (force: boolean, init: RequestInit = {}): RequestInitWithCache => ({
  ...init,
  cache: force ? 'no-cache' : 'default'
});
