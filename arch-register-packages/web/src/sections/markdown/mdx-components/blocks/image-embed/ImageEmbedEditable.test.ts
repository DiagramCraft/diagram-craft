import { describe, expect, it } from 'vitest';
import { imageEmbedMdxRule } from './ImageEmbedEditable';

describe('ImageEmbedEditable', () => {
  it('deserializes mdx props into the slate node shape', () => {
    const node = imageEmbedMdxRule.deserialize(
      {
        attributes: [
          { type: 'mdxJsxAttribute', name: 'id', value: 'file-1' },
          { type: 'mdxJsxAttribute', name: 'alt', value: 'Architecture image' },
          { type: 'mdxJsxAttribute', name: 'size', value: '75' },
          { type: 'mdxJsxAttribute', name: 'align', value: 'right' }
        ]
      },
      undefined,
      {
        editor: {
          getPlugin: () => ({ node: { type: 'ImageEmbed' } })
        }
      }
    );

    expect(node).toEqual({
      children: [{ text: '' }],
      type: 'ImageEmbed',
      fileId: 'file-1',
      alt: 'Architecture image',
      size: '75',
      align: 'right'
    });
  });

  it('serializes optional props only when present', () => {
    expect(
      imageEmbedMdxRule.serialize({
        fileId: 'file-1',
        alt: 'Architecture image',
        size: '75',
        align: 'right'
      })
    ).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'ImageEmbed',
      children: [],
      attributes: [
        { type: 'mdxJsxAttribute', name: 'id', value: 'file-1' },
        { type: 'mdxJsxAttribute', name: 'alt', value: 'Architecture image' },
        { type: 'mdxJsxAttribute', name: 'size', value: '75' },
        { type: 'mdxJsxAttribute', name: 'align', value: 'right' }
      ]
    });
  });
});
