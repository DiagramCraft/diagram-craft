import { describe, expect, it } from 'vitest';
import { advancedConfigOf, parseAdvancedConfig } from './EntityBrowserEmbedAdvancedConfig';
import {
  decodeEntityBrowserEmbedConfig,
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';

const base: EntityBrowserEmbedConfig = {
  q: '',
  conditions: [],
  sort: 'name',
  view: 'map',
  viewConfigs: {}
};

const overlay = {
  fieldId: 'Maturity',
  aggregation: 'average' as const,
  colourBands: [
    { max: 2.5, tone: 'bad' as const },
    { max: null, tone: 'good' as const }
  ]
};

describe('advanced widget config', () => {
  it('shows only the keys without a dedicated control', () => {
    expect(advancedConfigOf(base)).toEqual({});
    expect(advancedConfigOf({ ...base, title: 'x', overlays: [overlay] })).toEqual({
      overlays: [overlay]
    });
  });

  it('parses valid JSON, treating blank as no advanced config', () => {
    expect(parseAdvancedConfig('')).toEqual({ overlays: undefined, dimOwnerIds: undefined });
    expect(
      parseAdvancedConfig(JSON.stringify({ overlays: [overlay], dimOwnerIds: ['$owners'] }))
    ).toEqual({ overlays: [overlay], dimOwnerIds: ['$owners'] });
  });

  it('rejects invalid JSON, unknown keys and bad values', () => {
    expect(parseAdvancedConfig('{')).toBeNull();
    expect(parseAdvancedConfig('[]')).toBeNull();
    expect(parseAdvancedConfig('{"q":"x"}')).toBeNull();
    expect(parseAdvancedConfig('{"overlays":"all"}')).toBeNull();
    expect(parseAdvancedConfig('{"overlays":[{"fieldId":"a"}]}')).toBeNull();
    expect(parseAdvancedConfig('{"dimOwnerIds":[1]}')).toBeNull();
  });

  it('round-trips through the codec', () => {
    const config = { ...base, overlays: [overlay], dimOwnerIds: ['a'] };
    expect(decodeEntityBrowserEmbedConfig(encodeEntityBrowserEmbedConfig(config))).toMatchObject({
      overlays: [overlay],
      dimOwnerIds: ['a']
    });
  });
});
