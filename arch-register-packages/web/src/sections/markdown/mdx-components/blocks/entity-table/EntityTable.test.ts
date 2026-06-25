import { describe, expect, it, vi } from 'vitest';
import { parseMarkdownPreview } from '../../../preview/mdxMarkdown';
import {
  ENTITY_TABLE_TYPE,
  entityTableMdxRule
} from './EntityTableEditable';
import {
  hasEntityTableFilter,
  normalizeEntityTableLimit
} from './EntityTable';

vi.mock('platejs', () => ({
  getPluginType: (_editor: unknown, type: string) => type
}));

describe('EntityTable helpers', () => {
  it('defaults and clamps the limit', () => {
    expect(normalizeEntityTableLimit(undefined)).toBe(10);
    expect(normalizeEntityTableLimit('abc')).toBe(10);
    expect(normalizeEntityTableLimit('0')).toBe(1);
    expect(normalizeEntityTableLimit('20')).toBe(20);
    expect(normalizeEntityTableLimit('99')).toBe(50);
  });

  it('detects whether any inline filter is configured', () => {
    expect(hasEntityTableFilter({})).toBe(false);
    expect(hasEntityTableFilter({ schema: 'service' })).toBe(true);
    expect(hasEntityTableFilter({ owner: 'team-platform' })).toBe(true);
    expect(hasEntityTableFilter({ lifecycle: 'production' })).toBe(true);
  });
});

describe('entityTableMdxRule', () => {
  it('deserializes and serializes block props', () => {
    const deserialized = entityTableMdxRule.deserialize(
      {
        attributes: [
          { type: 'mdxJsxAttribute', name: 'schema', value: 'service' },
          { type: 'mdxJsxAttribute', name: 'owner', value: 'platform' },
          { type: 'mdxJsxAttribute', name: 'lifecycle', value: 'production' },
          { type: 'mdxJsxAttribute', name: 'limit', value: '20' }
        ]
      },
      undefined,
      { editor: {} }
    );

    expect(deserialized).toMatchObject({
      type: ENTITY_TABLE_TYPE,
      schema: 'service',
      owner: 'platform',
      lifecycle: 'production',
      limit: '20'
    });

    expect(entityTableMdxRule.serialize(deserialized)).toEqual({
      type: 'mdxJsxFlowElement',
      name: ENTITY_TABLE_TYPE,
      attributes: [
        { type: 'mdxJsxAttribute', name: 'schema', value: 'service' },
        { type: 'mdxJsxAttribute', name: 'owner', value: 'platform' },
        { type: 'mdxJsxAttribute', name: 'lifecycle', value: 'production' },
        { type: 'mdxJsxAttribute', name: 'limit', value: '20' }
      ],
      children: []
    });
  });

  it('omits empty props when serializing', () => {
    expect(
      entityTableMdxRule.serialize({
        schema: '',
        owner: '',
        lifecycle: 'production',
        limit: ''
      })
    ).toEqual({
      type: 'mdxJsxFlowElement',
      name: ENTITY_TABLE_TYPE,
      attributes: [{ type: 'mdxJsxAttribute', name: 'lifecycle', value: 'production' }],
      children: []
    });
  });
});

describe('EntityTable markdown parsing', () => {
  it('allows only the registered entity-table props in preview parsing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(
      parseMarkdownPreview(
        '<EntityTable schema=\"service\" owner=\"platform\" lifecycle=\"production\" limit=\"20\" view=\"saved\" />'
      )
    ).toEqual([
      {
        type: 'component',
        subtype: 'block',
        name: 'EntityTable',
        props: {
          schema: 'service',
          owner: 'platform',
          lifecycle: 'production',
          limit: '20'
        },
        source:
          '<EntityTable schema=\"service\" owner=\"platform\" lifecycle=\"production\" limit=\"20\" view=\"saved\" />'
      }
    ]);

    warnSpy.mockRestore();
  });
});
