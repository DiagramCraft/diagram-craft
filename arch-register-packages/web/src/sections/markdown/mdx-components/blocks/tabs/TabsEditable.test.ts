import { describe, expect, it } from 'vitest';
import { tabsMdxRule } from './TabsEditable';

// Minimal fake editor supporting the small surface of the Plate/@platejs/markdown
// APIs that tabsMdxRule's deserialize/serialize touch: getPlugin (used by
// getPluginType) and meta.pluginCache.node.types (used by getPluginKey, which
// convertChildrenDeserialize/convertNodesSerialize call internally to dispatch
// each nested child to its own registered mdxRule).
const fakeEditor = {
  getPlugin: ({ key }: { key: string }) => ({ node: { type: key } }),
  meta: { pluginCache: { node: { types: {} } } }
};

const tabRule = {
  deserialize: (mdastNode: {
    attributes?: Array<{ name: string; value: string }>;
    children?: unknown[];
  }) => ({
    type: 'Tab',
    label: mdastNode.attributes?.find(a => a.name === 'label')?.value ?? '',
    children: mdastNode.children?.length ? [{ text: 'nested' }] : [{ text: '' }]
  }),
  serialize: (slateNode: unknown) => ({
    type: 'mdxJsxFlowElement',
    name: 'Tab',
    attributes: [],
    children: [],
    _slateNode: slateNode
  })
};

const baseOptions = {
  editor: fakeEditor,
  rules: { Tab: tabRule }
};

describe('tabsMdxRule', () => {
  it('deserializes and keeps only Tab children', () => {
    const node = tabsMdxRule.deserialize(
      {
        type: 'mdxJsxFlowElement',
        name: 'Tabs',
        attributes: [],
        children: [
          {
            type: 'mdxJsxFlowElement',
            name: 'Tab',
            attributes: [{ type: 'mdxJsxAttribute', name: 'label', value: 'Linux' }],
            children: []
          },
          {
            type: 'mdxJsxFlowElement',
            name: 'Tab',
            attributes: [{ type: 'mdxJsxAttribute', name: 'label', value: 'macOS' }],
            children: []
          }
        ]
      },
      {},
      baseOptions as unknown as Parameters<typeof tabsMdxRule.deserialize>[2]
    );

    expect(node.type).toBe('Tabs');
    expect(node.children).toHaveLength(2);
    expect(node.children.every(child => (child as { type: string }).type === 'Tab')).toBe(true);
  });

  it('degrades to a single placeholder Tab child when none survive', () => {
    const node = tabsMdxRule.deserialize(
      { type: 'mdxJsxFlowElement', name: 'Tabs', attributes: [], children: [] },
      {},
      baseOptions as unknown as Parameters<typeof tabsMdxRule.deserialize>[2]
    );
    expect(node.children).toEqual([
      { type: 'Tab', label: '', children: [{ type: 'p', children: [{ text: '' }] }] }
    ]);
  });

  it('serializes all children via their own serializers with no attributes of its own', () => {
    const result = tabsMdxRule.serialize(
      {
        type: 'Tabs',
        children: [
          { type: 'Tab', label: 'Linux', children: [{ text: '' }] } as never,
          { type: 'Tab', label: 'macOS', children: [{ text: '' }] } as never
        ]
      },
      baseOptions as unknown as Parameters<typeof tabsMdxRule.serialize>[1]
    );

    expect(result.name).toBe('Tabs');
    expect(result.attributes).toEqual([]);
    expect(result.children).toHaveLength(2);
  });
});
