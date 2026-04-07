import { describe, expect, it } from 'vitest';
import { _test } from './ShapesPickerTab';

describe('ShapesPickerTab helpers', () => {
  it('should show only active configured packages in config order', () => {
    const registry = {
      get: (id: string) => {
        const aliases: Record<string, { id: string; name: string }> = {
          default: { id: 'default', name: 'Basic shapes' },
          arrow: { id: 'arrow-runtime', name: 'Arrow' },
          uml: { id: 'uml', name: 'UML' }
        };
        const value = aliases[id];
        if (!value) throw new Error(`Missing ${id}`);
        return value;
      },
      getStencils: () => [
        { id: 'uml', name: 'UML' },
        { id: 'default', name: 'Basic shapes' },
        { id: 'arrow-runtime', name: 'Arrow' },
        { id: 'extra', name: 'Extra' }
      ]
    };

    const appConfig = {
      stencils: {
        registry: [
          { id: 'default', name: 'Basic shapes' },
          { id: 'arrow', name: 'Arrow' },
          { id: 'uml', name: 'UML' }
        ]
      }
    };

    expect(
      _test.getVisibleStencilPackages(
        registry as never,
        appConfig.stencils.registry,
        ['uml', 'default']
      )
    ).toEqual([
      {
        id: 'default',
        name: 'Basic shapes',
        stencilPackage: { id: 'default', name: 'Basic shapes' }
      },
      {
        id: 'uml',
        name: 'UML',
        stencilPackage: { id: 'uml', name: 'UML' }
      }
    ]);
  });

  it('should resolve visible packages through registry aliases', () => {
    const registry = {
      get: (id: string) => {
        if (id === 'AWS') return { id: 'mxgraph.aws4', name: 'AWS' };
        throw new Error(`Missing ${id}`);
      },
      getStencils: () => [{ id: 'mxgraph.aws4', name: 'AWS' }]
    };

    expect(_test.getVisibleStencilPackages(registry as never, [{ id: 'AWS' }], ['AWS'])).toEqual([
      {
        id: 'AWS',
        name: 'AWS',
        stencilPackage: { id: 'mxgraph.aws4', name: 'AWS' }
      }
    ]);
  });
});
