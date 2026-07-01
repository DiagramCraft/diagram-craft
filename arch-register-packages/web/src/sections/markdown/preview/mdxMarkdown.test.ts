// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { encodeEntityBrowserEmbedConfig } from '../mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedCodec';

// Importing mdxMarkdown pulls in the full MDX_COMPONENTS registry, including the diagram-embed
// block, which transitively constructs main's MultiWindowDetector autosave singleton on import.
// That singleton reaches for localStorage/sessionStorage/BroadcastChannel, which aren't reliably
// present under this test environment's Node/jsdom combination — stub them before the dynamic
// import below so module-load side effects elsewhere in the app don't crash unrelated tests here.
const memoryStorage = (): Storage =>
  ({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0
  }) as unknown as Storage;

beforeAll(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

describe('parseMarkdownWithComponents', () => {
  it('preserves an EntityBrowserEmbed config prop unfiltered through the sanitizer', async () => {
    const { parseMarkdownWithComponents } = await import('./mdxMarkdown');

    const encoded = encodeEntityBrowserEmbedConfig({
      q: 'search "term" with {special}: chars, [brackets]',
      conditions: [{ fieldId: '_schemaId', op: 'equals', value: 'schema-1' }],
      sort: 'name',
      view: 'radar',
      viewConfigs: { radar: { xAxis: 'impact', yAxis: 'effort' } },
      projectScope: 'project'
    });

    const nodes = parseMarkdownWithComponents(`<EntityBrowserEmbed config="${encoded}" />`);
    const componentNode = nodes.find(node => node.type === 'component');

    expect(componentNode).toBeDefined();
    expect((componentNode as { props: Record<string, string> }).props.config).toBe(encoded);
  });
});
