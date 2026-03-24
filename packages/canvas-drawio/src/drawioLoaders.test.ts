// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { stencilLoaderDrawioXml } from './drawioLoaders';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { StencilRegistry } from '@diagram-craft/model/stencilRegistry';
import { defaultRegistry } from '@diagram-craft/canvas-app/defaultRegistry';

describe('stencilLoaderDrawioXml', () => {
  test('returns a package whose id comes from the xml root name', async () => {
    vi.spyOn(FileSystem, 'loadFromUrl').mockResolvedValue(`
      <shapes name="mxgraph.arrows">
        <shape name="Arrow Right" w="80" h="40" />
      </shapes>
    `);

    const pkg = await stencilLoaderDrawioXml(
      {} as never,
      { url: '/tmp/arrows.xml', foreground: '#000000', background: '#ffffff' }
    );

    expect(pkg.id).toBe('mxgraph.arrows');
    expect(pkg.stencils).toHaveLength(1);
  });

  test('registers using the xml-derived id and replaces the temporary alias', async () => {
    vi.spyOn(FileSystem, 'loadFromUrl').mockResolvedValue(`
      <shapes name="mxgraph.arrows">
        <shape name="Arrow Right" w="80" h="40" />
      </shapes>
    `);

    const stencilRegistry = new StencilRegistry();
    stencilRegistry.preRegister('Arrows', 'Arrows', async () => {
      const pkg = await stencilLoaderDrawioXml(
        defaultRegistry(),
        { url: '/tmp/arrows.xml', foreground: '#000000', background: '#ffffff' }
      );
      stencilRegistry.register(pkg.name ?? 'Arrows', pkg, ['Arrows']);
    });

    await stencilRegistry.loadStencilPackage('Arrows');

    expect(stencilRegistry.getStencils().map(s => s.id)).toEqual(['mxgraph.arrows']);
    expect(stencilRegistry.get('Arrows').id).toBe('mxgraph.arrows');
    expect(stencilRegistry.get('mxgraph.arrows').stencils[0]?.id).toBe(
      'mxgraph.arrows@@Arrow Right'
    );
  });
});
