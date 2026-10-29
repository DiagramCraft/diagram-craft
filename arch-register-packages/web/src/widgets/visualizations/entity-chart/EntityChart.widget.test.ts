import { describe, expect, it } from 'vitest';
import { isValidComponentConfig } from '../../shared/widgetRegistry';
import widget from './EntityChart.widget';

const mdxRule = widget.mdx!.editorSpec!.mdxRule;

describe('EntityChart widget', () => {
  it('requires at least one filter', () => {
    const base = { groupBy: 'lifecycle', chartType: 'donut' };
    expect(isValidComponentConfig(widget, base)).toBe(false);
    expect(isValidComponentConfig(widget, { ...base, schema: 's' })).toBe(true);
    expect(isValidComponentConfig(widget, { ...base, owner: 'o' })).toBe(true);
    expect(isValidComponentConfig(widget, { ...base, lifecycle: 'l' })).toBe(true);
  });

  it('round-trips mdx attributes', () => {
    const attributes = [
      { type: 'mdxJsxAttribute' as const, name: 'schema', value: 'service' },
      { type: 'mdxJsxAttribute' as const, name: 'groupBy', value: 'owner' },
      { type: 'mdxJsxAttribute' as const, name: 'chartType', value: 'bar' }
    ];
    const node = mdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'EntityChart', children: [], attributes },
      {},
      {
        editor: { getPlugin: () => ({ node: { type: 'EntityChart' } }) }
      } as unknown as Parameters<typeof mdxRule.deserialize>[2]
    );

    expect(node).toMatchObject({
      type: 'EntityChart',
      schema: 'service',
      groupBy: 'owner',
      chartType: 'bar'
    });
    expect(mdxRule.serialize(node, {})).toMatchObject({ name: 'EntityChart', attributes });
  });
});
