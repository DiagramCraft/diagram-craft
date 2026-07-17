import { describe, expect, it } from 'vitest';
import { columnMdxRule } from './ColumnEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that columnMdxRule's deserialize/serialize touch: getPlugin (used by
// getPluginType) and meta.pluginCache.node.types (used by getPluginKey, which
// convertChildrenDeserialize/convertNodesSerialize call internally to dispatch
// each nested child to its own registered mdxRule).
const fakeEditor = {
  getPlugin: ({ key }: { key: string }) => ({ node: { type: key } }),
  meta: { pluginCache: { node: { types: {} } } }
};

const diagramEmbedRule = {
  deserialize: (mdastNode: { attributes?: Array<{ name: string; value: string }> }) => ({
    type: 'DiagramEmbed',
    fileId: mdastNode.attributes?.find(a => a.name === 'id')?.value ?? '',
    children: [{ text: '' }]
  }),
  serialize: (slateNode: { fileId?: string }) => ({
    type: 'mdxJsxFlowElement',
    name: 'DiagramEmbed',
    attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: slateNode.fileId ?? '' }],
    children: []
  })
};

const baseOptions = {
  editor: fakeEditor,
  rules: { DiagramEmbed: diagramEmbedRule }
};

describe('columnMdxRule', () => {
  it('deserializes every child, including other MDX components', () => {
    const node = columnMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Column',
        attributes: [],
        children: [
          {
            type: 'mdxJsxFlowElement',
            name: 'DiagramEmbed',
            attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: 'd1' }],
            children: []
          }
        ]
      },
      {},
      baseOptions as unknown as Parameters<typeof columnMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('Column');
    expect(node.children).toEqual([
      { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] }
    ]);
  });

  it('degrades to a placeholder paragraph child when there are zero children', () => {
    const node = columnMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Column', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof columnMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([{ type: 'p', children: [{ text: '' }] }]);
  });

  it('serializes all children via their own serializers', () => {
    const result = columnMdxRule.serialize(
      {
        type: 'Column',
        children: [{ type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] } as never]
      },
      baseOptions as unknown as Parameters<typeof columnMdxRule.serialize>[1]
    );

    expect(result).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Column',
      attributes: [],
      children: [
        {
          type: 'mdxJsxFlowElement',
          name: 'DiagramEmbed',
          attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: 'd1' }],
          children: []
        }
      ]
    });
  });
});
