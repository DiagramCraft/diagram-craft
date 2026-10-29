import { describe, expect, it } from 'vitest';
import { isValidComponentConfig } from '../../shared/widgetRegistry';
import widget from './ImageEmbed.widget';

const imageEmbedMdxRule = widget.mdx!.editorSpec!.mdxRule;

describe('ImageEmbed widget', () => {
  it('requires a file', () => {
    expect(isValidComponentConfig(widget, { fileId: '', size: '100', align: 'center' })).toBe(
      false
    );
    expect(isValidComponentConfig(widget, { fileId: 'f', size: '100', align: 'center' })).toBe(
      true
    );
  });

  it('deserializes mdx props into the slate node shape', () => {
    const node = imageEmbedMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'ImageEmbed',
        children: [],
        attributes: [
          { type: 'mdxJsxAttribute', name: 'id', value: 'file-1' },
          { type: 'mdxJsxAttribute', name: 'alt', value: 'Architecture image' },
          { type: 'mdxJsxAttribute', name: 'size', value: '75' },
          { type: 'mdxJsxAttribute', name: 'align', value: 'right' }
        ]
      },
      {},
      {
        editor: {
          getPlugin: () => ({ node: { type: 'ImageEmbed' } })
        }
      } as unknown as Parameters<typeof imageEmbedMdxRule.deserialize>[2]
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
      imageEmbedMdxRule.serialize(
        {
          type: 'ImageEmbed',
          children: [{ text: '' }],
          fileId: 'file-1',
          alt: 'Architecture image',
          size: '75',
          align: 'right'
        },
        {}
      )
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
