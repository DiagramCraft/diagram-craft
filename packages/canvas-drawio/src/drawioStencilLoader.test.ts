// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import {
  loadDrawioStencilPackage,
  parseDrawioStencilPackage
} from './drawioStencilLoader';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';

describe('parseDrawioStencilPackage', () => {
  test('extracts the root shapes name as the package id', () => {
    const pkg = parseDrawioStencilPackage(
      `
        <shapes name="mxgraph.arrows">
          <shape name="Arrow Right" w="80" h="40" />
        </shapes>
      `,
      '#111111',
      '#eeeeee'
    );

    expect(pkg.id).toBe('mxgraph.arrows');
    expect(pkg.stencils).toHaveLength(1);
    expect(pkg.stencils[0]?.key).toBe('Arrow Right');
  });

  test('rejects files without a root shapes name', () => {
    expect(() =>
      parseDrawioStencilPackage(
        `
          <shapes>
            <shape name="Arrow Right" w="80" h="40" />
          </shapes>
        `
      )
    ).toThrow('Draw.io stencil file is missing root <shapes name="...">');
  });
});

describe('loadDrawioStencilPackage', () => {
  test('loads the package id and stencils from the xml file', async () => {
    vi.spyOn(FileSystem, 'loadFromUrl').mockResolvedValue(`
      <shapes name="mxgraph.basic">
        <shape name="Rect" w="120" h="80" />
      </shapes>
    `);

    await expect(loadDrawioStencilPackage('/tmp/basic.xml')).resolves.toMatchObject({
      id: 'mxgraph.basic',
      stencils: [{ key: 'Rect' }]
    });
  });
});
