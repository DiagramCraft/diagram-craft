import { describe, expect, it } from 'vitest';
import { columnsMdxRule } from './ColumnsEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that columnsMdxRule's deserialize/serialize touch: getPlugin (used by
// getPluginType) and meta.pluginCache.node.types (used by getPluginKey, which
// convertChildrenDeserialize/convertNodesSerialize call internally to dispatch
// each nested child to its own registered mdxRule).
const fakeEditor = {
  getPlugin: ({ key }: { key: string }) => ({ node: { type: key } }),
  meta: { pluginCache: { node: { types: {} } } }
};

const columnRule = {
  deserialize: (mdastNode: { children?: unknown[] }) => ({
    type: 'Column',
    children: mdastNode.children?.length ? [{ text: 'nested' }] : [{ text: '' }]
  }),
  serialize: (slateNode: unknown) => ({
    type: 'mdxJsxFlowElement',
    name: 'Column',
    attributes: [],
    children: [],
    _slateNode: slateNode
  })
};

const baseOptions = {
  editor: fakeEditor,
  rules: { Column: columnRule }
};

describe('columnsMdxRule', () => {
  it('deserializes the count attribute and keeps only Column children', () => {
    const node = columnsMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Columns',
        attributes: [{ type: 'mdxJsxAttribute', name: 'count', value: '3' }],
        children: [
          { type: 'mdxJsxFlowElement', name: 'Column', attributes: [], children: [] },
          { type: 'mdxJsxFlowElement', name: 'Column', attributes: [], children: [] }
        ]
      },
      {},
      baseOptions as unknown as Parameters<typeof columnsMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('Columns');
    expect(node.count).toBe('3');
    expect(node.children).toHaveLength(2);
    expect(node.children.every(child => (child as { type: string }).type === 'Column')).toBe(true);
  });

  it('defaults count to "2" for any unrecognized or missing value', () => {
    const node = columnsMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Columns', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof columnsMdxRule.deserialize>[2]
    );
    expect(node.count).toBe('2');
  });

  it('degrades to two placeholder Column children when none survive', () => {
    const node = columnsMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Columns', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof columnsMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([
      { type: 'Column', children: [{ type: 'p', children: [{ text: '' }] }] },
      { type: 'Column', children: [{ type: 'p', children: [{ text: '' }] }] }
    ]);
  });

  it('serializes the count attribute and all children via their own serializers', () => {
    const result = columnsMdxRule.serialize(
      {
        type: 'Columns',
        count: '3',
        children: [
          { type: 'Column', children: [{ text: '' }] } as never,
          { type: 'Column', children: [{ text: '' }] } as never
        ]
      },
      baseOptions as unknown as Parameters<typeof columnsMdxRule.serialize>[1]
    );

    expect(result.name).toBe('Columns');
    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'count', value: '3' }]);
    expect(result.children).toHaveLength(2);
  });

  it('defaults the serialized count to "2" when unset', () => {
    const result = columnsMdxRule.serialize(
      { type: 'Columns', children: [] },
      baseOptions as unknown as Parameters<typeof columnsMdxRule.serialize>[1]
    );
    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'count', value: '2' }]);
  });
});
