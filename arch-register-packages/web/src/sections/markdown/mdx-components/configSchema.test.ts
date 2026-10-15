import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  decodeConfigAttribute,
  encodeConfigAttribute,
  flatConfigCodec,
  parseConfigFields
} from './configSchema';
import { documentBrowserEmbedCodec } from './blocks/document-browser-embed/DocumentBrowserEmbedCodec';
import {
  entityBrowserEmbedCodec,
  entityBrowserEmbedConfigSchema
} from './blocks/entity-browser-embed/EntityBrowserEmbedCodec';

const schema = z.object({ name: z.string(), count: z.number().int().optional() });

describe('parseConfigFields', () => {
  it('falls back to the default for each missing or invalid field only', () => {
    expect(parseConfigFields(schema, { name: 3, count: 4 }, { name: 'default', count: 1 })).toEqual(
      { name: 'default', count: 4 }
    );
  });

  it('uses the defaults for non-object input', () => {
    expect(parseConfigFields(schema, 'nope', { name: 'default' })).toEqual({
      name: 'default',
      count: undefined
    });
  });
});

describe('config attribute', () => {
  it('round-trips unicode payloads', () => {
    const payload = { q: 'räksmörgås ✓' };
    expect(decodeConfigAttribute(encodeConfigAttribute(payload))).toEqual(payload);
  });

  it('returns null for empty, malformed and non-object values', () => {
    expect(decodeConfigAttribute(undefined)).toBeNull();
    expect(decodeConfigAttribute('!!!')).toBeNull();
    expect(decodeConfigAttribute(encodeConfigAttribute([1, 2]))).toBeNull();
  });
});

describe('document browser config', () => {
  it('drops stale column ids instead of resetting the whole list', () => {
    const raw = encodeConfigAttribute({
      visibleBaseColumnIds: ['location', 'removed_column'],
      visibleFieldIds: ['a', 7],
      sortDir: 'sideways'
    });
    expect(documentBrowserEmbedCodec.decode(raw)).toEqual({
      ...documentBrowserEmbedCodec.createDefault(),
      visibleBaseColumnIds: ['location'],
      visibleFieldIds: ['a']
    });
  });

  it('round-trips a config', () => {
    const config = {
      ...documentBrowserEmbedCodec.createDefault(),
      q: 'x',
      sortDir: 'asc' as const
    };
    expect(documentBrowserEmbedCodec.decode(documentBrowserEmbedCodec.encode(config))).toEqual(
      config
    );
  });
});

describe('entity browser config schema', () => {
  it('accepts the default config and rejects an unknown view', () => {
    const config = entityBrowserEmbedCodec.createDefault();
    expect(entityBrowserEmbedConfigSchema.safeParse(config).success).toBe(true);
    expect(entityBrowserEmbedConfigSchema.safeParse({ ...config, view: 'nope' }).success).toBe(
      false
    );
  });

  it('rejects a non-positive limit', () => {
    const config = entityBrowserEmbedCodec.createDefault();
    expect(entityBrowserEmbedConfigSchema.safeParse({ ...config, limit: 0 }).success).toBe(false);
  });
});

describe('flatConfigCodec', () => {
  const flatSchema = z.object({
    entityId: z.string().min(1),
    limit: z.number().int().optional(),
    showLink: z.boolean().optional()
  });
  const codec = flatConfigCodec(flatSchema, { attributeNames: { entityId: 'id' } });
  const defaults = { entityId: '', limit: 10, showLink: true };

  it('coerces attribute strings by field type', () => {
    expect(codec.decode({ entityId: 'A', limit: '5', showLink: 'false' }, defaults)).toEqual({
      entityId: 'A',
      limit: 5,
      showLink: false
    });
  });

  it('falls back to defaults for missing or invalid values', () => {
    expect(codec.decode({ entityId: '', limit: 'x', showLink: '' }, defaults)).toEqual(defaults);
  });

  it('writes every key, using an empty string for unset values', () => {
    expect(codec.encode({ entityId: 'A', limit: undefined, showLink: false })).toEqual({
      entityId: 'A',
      limit: '',
      showLink: 'false'
    });
  });
});
