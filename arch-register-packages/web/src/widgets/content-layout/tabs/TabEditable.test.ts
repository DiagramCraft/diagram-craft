import { describe, expect, it } from 'vitest';
import { tabMdxRule } from './TabEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that tabMdxRule's deserialize/serialize touch: getPlugin (used by
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

describe('tabMdxRule', () => {
  it('deserializes the label attribute and keeps every child', () => {
    const node = tabMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Tab',
        attributes: [{ type: 'mdxJsxAttribute', name: 'label', value: 'Linux' }],
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
      baseOptions as unknown as Parameters<typeof tabMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('Tab');
    expect(node.label).toBe('Linux');
    expect(node.children).toEqual([
      { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] }
    ]);
  });

  it('defaults the label to an empty string when missing', () => {
    const node = tabMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Tab', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof tabMdxRule.deserialize>[2]
    );
    expect(node.label).toBe('');
  });

  it('degrades to a placeholder paragraph child when there are zero children', () => {
    const node = tabMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Tab', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof tabMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([{ type: 'p', children: [{ text: '' }] }]);
  });

  it('serializes the label and all children via their own serializers', () => {
    const result = tabMdxRule.serialize(
      {
        type: 'Tab',
        label: 'Linux',
        children: [{ type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] } as never]
      },
      baseOptions as unknown as Parameters<typeof tabMdxRule.serialize>[1]
    );

    expect(result.name).toBe('Tab');
    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'label', value: 'Linux' }]);
    expect(result.children).toHaveLength(1);
  });

  it('defaults the serialized label to an empty string when unset', () => {
    const result = tabMdxRule.serialize(
      { type: 'Tab', children: [] },
      baseOptions as unknown as Parameters<typeof tabMdxRule.serialize>[1]
    );
    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'label', value: '' }]);
  });
});
