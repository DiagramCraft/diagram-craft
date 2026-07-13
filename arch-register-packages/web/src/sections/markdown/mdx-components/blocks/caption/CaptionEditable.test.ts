import { describe, expect, it } from 'vitest';
import { captionMdxRule } from './CaptionEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that captionMdxRule's deserialize/serialize touch: getPlugin (used by
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

describe('captionMdxRule', () => {
  it('deserializes caption/align/numbered attributes and the single valid child', () => {
    const node = captionMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Caption',
        attributes: [
          { type: 'mdxJsxAttribute', name: 'caption', value: 'A diagram' },
          { type: 'mdxJsxAttribute', name: 'align', value: 'left' },
          { type: 'mdxJsxAttribute', name: 'numbered', value: 'true' }
        ],
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
      baseOptions as unknown as Parameters<typeof captionMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('Caption');
    expect(node.caption).toBe('A diagram');
    expect(node.align).toBe('left');
    expect(node.numbered).toBe(true);
    expect(node.children).toEqual([
      { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] }
    ]);
  });

  it('degrades to a placeholder paragraph child when there are zero children', () => {
    const node = captionMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Caption', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof captionMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([{ type: 'p', children: [{ text: '' }] }]);
  });

  it('serializes caption/align/numbered and the child via its own serializer', () => {
    const result = captionMdxRule.serialize(
      {
        type: 'Caption',
        caption: 'A diagram',
        align: 'left',
        numbered: true,
        children: [{ type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] } as never]
      },
      baseOptions as unknown as Parameters<typeof captionMdxRule.serialize>[1]
    );

    expect(result).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Caption',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'caption', value: 'A diagram' },
        { type: 'mdxJsxAttribute', name: 'align', value: 'left' },
        { type: 'mdxJsxAttribute', name: 'numbered', value: 'true' }
      ],
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

  it('omits align/numbered attributes when not set', () => {
    const result = captionMdxRule.serialize(
      { type: 'Caption', caption: 'x', children: [] },
      baseOptions as unknown as Parameters<typeof captionMdxRule.serialize>[1]
    );
    expect(result.attributes).toEqual([{ type: 'mdxJsxAttribute', name: 'caption', value: 'x' }]);
  });
});
