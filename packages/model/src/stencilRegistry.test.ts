import { describe, expect, it } from 'vitest';
import { StencilRegistry, type StencilPackage } from './stencilRegistry';

const makeStencil = (id: string) => ({
  id,
  type: 'yaml' as const,
  forPicker: () => {
    throw new Error('not used');
  },
  forCanvas: () => {
    throw new Error('not used');
  }
});

describe('StencilRegistry.register', () => {
  it('assigns a single subpackage-prefixed id when the same stencil is present in package and subpackage arrays', () => {
    const registry = new StencilRegistry();
    const sharedStencil = makeStencil('uml-class-class');
    const pkg: StencilPackage = {
      type: 'default',
      stencils: [sharedStencil],
      subPackages: [{ id: 'class', name: 'Class', stencils: [sharedStencil] }]
    };

    registry.register('uml', 'UML', pkg);

    expect(sharedStencil.id).toBe('uml@@class@@uml-class-class');
    expect(registry.getStencil('uml@@class@@uml-class-class')).toBe(sharedStencil);
  });

  it('keeps top-level-only stencils on the package-prefixed id format', () => {
    const registry = new StencilRegistry();
    const stencil = makeStencil('table');
    const pkg: StencilPackage = {
      type: 'default',
      stencils: [stencil]
    };

    registry.register('default', 'Default', pkg);

    expect(stencil.id).toBe('default@@table');
    expect(registry.getStencil('default@@table')).toBe(stencil);
  });
});
