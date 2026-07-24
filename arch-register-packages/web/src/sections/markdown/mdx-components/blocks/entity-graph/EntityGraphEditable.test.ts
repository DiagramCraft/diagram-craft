import { describe, expect, it } from 'vitest';
import { entityGraphMdxRule } from './EntityGraphEditable';

const fakeEditor = {
  getPlugin: ({ key }: { key: string }) => ({ node: { type: key } })
};

const options = {
  editor: fakeEditor
} as unknown as Parameters<typeof entityGraphMdxRule.serialize>[1];

describe('entityGraphMdxRule', () => {
  it('omits default depth and direction when serializing', () => {
    const result = entityGraphMdxRule.serialize(
      { type: 'EntityGraph', entityId: 'APP-001', depth: 1, direction: 'both', children: [] },
      options
    );

    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'id', value: 'APP-001' }]);
  });

  it('serializes non-default graph options and normalizes them on deserialize', () => {
    const result = entityGraphMdxRule.serialize(
      {
        type: 'EntityGraph',
        entityId: 'APP-001',
        depth: 3,
        direction: 'downstream',
        children: []
      },
      options
    );

    expect(result.attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'id', value: 'APP-001' },
      { type: 'mdxJsxAttribute', name: 'depth', value: '3' },
      { type: 'mdxJsxAttribute', name: 'direction', value: 'downstream' }
    ]);

    const node = entityGraphMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'EntityGraph',
        attributes: [
          { type: 'mdxJsxAttribute', name: 'id', value: 'APP-001' },
          { type: 'mdxJsxAttribute', name: 'depth', value: '100' },
          { type: 'mdxJsxAttribute', name: 'direction', value: 'invalid' }
        ],
        children: []
      },
      {},
      options as never
    );

    expect(node.entityId).toBe('APP-001');
    expect(node.depth).toBe(3);
    expect(node.direction).toBe('both');
  });
});
