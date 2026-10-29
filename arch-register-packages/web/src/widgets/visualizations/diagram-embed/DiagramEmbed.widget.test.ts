import { describe, expect, it } from 'vitest';
import { isValidComponentConfig } from '../../shared/widgetRegistry';
import widget from './DiagramEmbed.widget';

const mdxRule = widget.mdx!.editorSpec!.mdxRule;

describe('DiagramEmbed widget', () => {
  it('requires a diagram', () => {
    expect(isValidComponentConfig(widget, { fileId: '' })).toBe(false);
    expect(isValidComponentConfig(widget, { fileId: 'd-1' })).toBe(true);
  });

  it('round-trips the id and caption attributes', () => {
    const attributes = [
      { type: 'mdxJsxAttribute' as const, name: 'id', value: 'd-1' },
      { type: 'mdxJsxAttribute' as const, name: 'caption', value: 'Overview' }
    ];
    const node = mdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'DiagramEmbed', children: [], attributes },
      {},
      {
        editor: { getPlugin: () => ({ node: { type: 'DiagramEmbed' } }) }
      } as unknown as Parameters<typeof mdxRule.deserialize>[2]
    );

    expect(node).toMatchObject({ type: 'DiagramEmbed', fileId: 'd-1', caption: 'Overview' });
    expect(mdxRule.serialize(node, {})).toMatchObject({ name: 'DiagramEmbed', attributes });
  });
});
