import { describe, expect, it } from 'vitest';
import { foldableSectionMdxRule } from './FoldableSectionEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that foldableSectionMdxRule's deserialize/serialize touch: getPlugin (used
// by getPluginType) and meta.pluginCache.node.types (used by getPluginKey, which
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

describe('foldableSectionMdxRule', () => {
  it('deserializes the label attribute and keeps every child, not just one', () => {
    const node = foldableSectionMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'FoldableSection',
        attributes: [{ type: 'mdxJsxAttribute', name: 'label', value: 'Background' }],
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
      baseOptions as unknown as Parameters<typeof foldableSectionMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('FoldableSection');
    expect(node.label).toBe('Background');
    expect(node.children).toEqual([
      { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] },
      { type: 'DiagramEmbed', fileId: 'd2', children: [{ text: '' }] }
    ]);
  });

  it('defaults the label to an empty string when missing', () => {
    const node = foldableSectionMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'FoldableSection', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof foldableSectionMdxRule.deserialize>[2]
    );
    expect(node.label).toBe('');
  });

  it('degrades to a placeholder paragraph child when there are zero children', () => {
    const node = foldableSectionMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'FoldableSection', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof foldableSectionMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([{ type: 'p', children: [{ text: '' }] }]);
  });

  it('serializes the label and all children via their own serializers', () => {
    const result = foldableSectionMdxRule.serialize(
      {
        type: 'FoldableSection',
        label: 'Background',
        children: [
          { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] } as never,
          { type: 'DiagramEmbed', fileId: 'd2', children: [{ text: '' }] } as never
        ]
      },
      baseOptions as unknown as Parameters<typeof foldableSectionMdxRule.serialize>[1]
    );

    expect(result.name).toBe('FoldableSection');
    expect(result.attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'label', value: 'Background' }
    ]);
    expect(result.children).toHaveLength(2);
  });

  it('defaults the serialized label to an empty string when unset', () => {
    const result = foldableSectionMdxRule.serialize(
      { type: 'FoldableSection', children: [] },
      baseOptions as unknown as Parameters<typeof foldableSectionMdxRule.serialize>[1]
    );
    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'label', value: '' }]);
  });
});
