import { describe, expect, it } from 'vitest';
import { calloutMdxRule } from './CalloutEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that calloutMdxRule's deserialize/serialize touch: getPlugin (used by
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

describe('calloutMdxRule', () => {
  it('deserializes the variant attribute and keeps every child, not just one', () => {
    const node = calloutMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Callout',
        attributes: [{ type: 'mdxJsxAttribute', name: 'variant', value: 'warning' }],
        children: [
          {
            type: 'mdxJsxFlowElement',
            name: 'DiagramEmbed',
            attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: 'd1' }],
            children: []
          },
          {
            type: 'mdxJsxFlowElement',
            name: 'DiagramEmbed',
            attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: 'd2' }],
            children: []
          }
        ]
      },
      {},
      baseOptions as unknown as Parameters<typeof calloutMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('Callout');
    expect(node.variant).toBe('warning');
    expect(node.children).toEqual([
      { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] },
      { type: 'DiagramEmbed', fileId: 'd2', children: [{ text: '' }] }
    ]);
  });

  it('falls back to the info variant for missing or unknown variants', () => {
    const missing = calloutMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Callout', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof calloutMdxRule.deserialize>[2]
    );
    expect(missing.variant).toBe('info');

    const unknown = calloutMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Callout',
        attributes: [{ type: 'mdxJsxAttribute', name: 'variant', value: 'spicy' }],
        children: []
      },
      {},
      baseOptions as unknown as Parameters<typeof calloutMdxRule.deserialize>[2]
    );
    expect(unknown.variant).toBe('info');
  });

  it('degrades to a placeholder paragraph child when there are zero children', () => {
    const node = calloutMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Callout', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof calloutMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([{ type: 'p', children: [{ text: '' }] }]);
  });

  it('serializes the variant and all children via their own serializers', () => {
    const result = calloutMdxRule.serialize(
      {
        type: 'Callout',
        variant: 'danger',
        children: [
          { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] } as never,
          { type: 'DiagramEmbed', fileId: 'd2', children: [{ text: '' }] } as never
        ]
      },
      baseOptions as unknown as Parameters<typeof calloutMdxRule.serialize>[1]
    );

    expect(result.name).toBe('Callout');
    expect(result.attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'variant', value: 'danger' }
    ]);
    expect(result.children).toHaveLength(2);
  });

  it('defaults the serialized variant to info when unset', () => {
    const result = calloutMdxRule.serialize(
      { type: 'Callout', children: [] },
      baseOptions as unknown as Parameters<typeof calloutMdxRule.serialize>[1]
    );
    expect(result.attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'variant', value: 'info' }
    ]);
  });
});
