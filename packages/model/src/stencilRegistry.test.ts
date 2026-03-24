import { describe, expect, it } from 'vitest';
import {
  getStencilsInPackage,
  StencilRegistry,
  type Stencil,
  type StencilPackage
} from './stencilRegistry';

const makeStencil = (id: string, name = id): Stencil => ({
  id,
  name,
  type: 'yaml',
  forPicker: () => {
    throw new Error('not used');
  },
  forCanvas: () => {
    throw new Error('not used');
  }
});

describe('StencilRegistry', () => {
  it('qualifies and resolves subpackage-only stencils', () => {
    const registry = new StencilRegistry();
    const subpackageStencil = makeStencil('uml-class-class');
    const pkg: StencilPackage = {
      type: 'default',
      stencils: [],
      subPackages: [{ id: 'class', name: 'Class', stencils: [subpackageStencil] }]
    };

    registry.register('uml', 'UML', pkg);

    expect(subpackageStencil.id).toBe('uml@@class@@uml-class-class');
    expect(registry.getStencil('uml@@class@@uml-class-class')).toBe(subpackageStencil);
  });

  it('qualifies and resolves root-only stencils', () => {
    const registry = new StencilRegistry();
    const rootStencil = makeStencil('table');
    const pkg: StencilPackage = {
      type: 'default',
      stencils: [rootStencil]
    };

    registry.register('default', 'Default', pkg);

    expect(rootStencil.id).toBe('default@@table');
    expect(registry.getStencil('default@@table')).toBe(rootStencil);
  });

  it('searches across root and subpackage stencils without duplication', async () => {
    const registry = new StencilRegistry();
    const rootStencil = makeStencil('root-shape', 'Root Shape');
    const subpackageStencil = makeStencil('class-shape', 'Class Shape');
    const pkg: StencilPackage = {
      type: 'default',
      stencils: [rootStencil],
      subPackages: [{ id: 'class', name: 'Class', stencils: [subpackageStencil] }]
    };

    registry.register('uml', 'UML', pkg);

    await expect(registry.search('UML')).resolves.toEqual([rootStencil, subpackageStencil]);
    await expect(registry.search('Class Shape')).resolves.toEqual([subpackageStencil]);
    expect(getStencilsInPackage(registry.get('uml'))).toEqual([rootStencil, subpackageStencil]);
  });

  it('allows packages to mix root-owned and subpackage-owned stencils', () => {
    const registry = new StencilRegistry();
    const rootStencil = makeStencil('root-shape');
    const subpackageStencil = makeStencil('class-shape');
    const pkg: StencilPackage = {
      type: 'default',
      stencils: [rootStencil],
      subPackages: [{ id: 'class', name: 'Class', stencils: [subpackageStencil] }]
    };

    registry.register('uml', 'UML', pkg);

    const registered = registry.get('uml');
    expect(registered.stencils).toEqual([rootStencil]);
    expect(registered.subPackages?.[0]?.stencils).toEqual([subpackageStencil]);
    expect(getStencilsInPackage(registered)).toHaveLength(2);
  });
});
