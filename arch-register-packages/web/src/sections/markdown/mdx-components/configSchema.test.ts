import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { decodeConfigAttribute, encodeConfigAttribute, parseConfigFields } from './configSchema';
import {
  decodeDocumentBrowserEmbedConfig,
  encodeDocumentBrowserEmbedConfig,
  createDefaultDocumentBrowserEmbedConfig
} from './blocks/document-browser-embed/DocumentBrowserEmbedCodec';
import {
  entityBrowserEmbedConfigSchema,
  createDefaultEntityBrowserEmbedConfig
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
    expect(decodeDocumentBrowserEmbedConfig(raw)).toEqual({
      ...createDefaultDocumentBrowserEmbedConfig(),
      visibleBaseColumnIds: ['location'],
      visibleFieldIds: ['a']
    });
  });

  it('round-trips a config', () => {
    const config = {
      ...createDefaultDocumentBrowserEmbedConfig(),
      q: 'x',
      sortDir: 'asc' as const
    };
    expect(decodeDocumentBrowserEmbedConfig(encodeDocumentBrowserEmbedConfig(config))).toEqual(
      config
    );
  });
});

describe('entity browser config schema', () => {
  it('accepts the default config and rejects an unknown view', () => {
    const config = createDefaultEntityBrowserEmbedConfig();
    expect(entityBrowserEmbedConfigSchema.safeParse(config).success).toBe(true);
    expect(entityBrowserEmbedConfigSchema.safeParse({ ...config, view: 'nope' }).success).toBe(
      false
    );
  });

  it('rejects a non-positive limit', () => {
    const config = createDefaultEntityBrowserEmbedConfig();
    expect(entityBrowserEmbedConfigSchema.safeParse({ ...config, limit: 0 }).success).toBe(false);
  });
});
