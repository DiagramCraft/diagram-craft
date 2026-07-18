import { describe, expect, it, vi } from 'vitest';
import { NodeDefinitionRegistry } from './nodeDefinitionRegistry';
import { CustomPropertyDefinition } from './customProperty';
import { PathList } from '@diagram-craft/geometry/pathList';
import type { NodeDefinition } from './nodeDefinition';
import type { LazyElementLoaderEntry } from './lazyElementLoader';
import { NoopMissingDefinitionReporter } from './abstractDefinitionRegistry';

const makeNodeDefinition = (type: string): NodeDefinition => ({
  type,
  name: type,
  additionalFillCount: 0,
  hasFlag: () => false,
  getCustomPropertyDefinitions: () => new CustomPropertyDefinition(),
  getBoundingPath: () => new PathList([]),
  getHitArea: () => undefined,
  getAnchors: () => [],
  onAttachEdge: () => undefined,
  onChildChanged: () => {},
  onTransform: () => {},
  onPropUpdate: () => {},
  onAdd: () => {},
  requestFocus: () => {}
});

describe('NodeDefinitionRegistry', () => {
  it('warns only once per missing shape type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const registry = new NodeDefinitionRegistry();
      registry.register(makeNodeDefinition('rect'));

      expect(registry.get('umlClass').type).toBe('rect');
      expect(registry.get('umlClass').type).toBe('rect');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not report missing shapes when given a no-op reporter', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const registry = new NodeDefinitionRegistry([], new NoopMissingDefinitionReporter());
      registry.register(makeNodeDefinition('rect'));

      expect(registry.get('umlClass').type).toBe('rect');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('lazy loads a node definition matching a shape pattern', async () => {
    let loaded = false;
    const lazyLoaders: Array<LazyElementLoaderEntry> = [
      {
        shapes: /^uml/,
        nodeDefinitionLoader: async () => async (registry: NodeDefinitionRegistry) => {
          loaded = true;
          registry.register(makeNodeDefinition('umlClass'));
        }
      }
    ];

    const registry = new NodeDefinitionRegistry(lazyLoaders);
    registry.register(makeNodeDefinition('rect'));

    expect(await registry.load('umlClass')).toBe(true);
    expect(loaded).toBe(true);
    expect(registry.hasRegistration('umlClass')).toBe(true);
  });

  it('returns false when no lazy loader matches', async () => {
    const registry = new NodeDefinitionRegistry();
    expect(await registry.load('unknownShape')).toBe(false);
  });
});
