import { describe, expect, it } from 'vitest';
import { EdgeDefinitionRegistry } from './edgeDefinitionRegistry';
import { CustomPropertyDefinition } from './customProperty';
import type { EdgeDefinition } from './edgeDefinition';
import type { LazyElementLoaderEntry } from './lazyElementLoader';

const makeEdgeDefinition = (type: string): EdgeDefinition => ({
  type,
  name: type,
  hasFlag: () => false,
  onDrop: () => {},
  getCustomPropertyDefinitions: () => new CustomPropertyDefinition()
});

describe('EdgeDefinitionRegistry', () => {
  it('falls back to the configured default edge definition without warning', () => {
    const defaultDefinition = makeEdgeDefinition('default');
    const registry = new EdgeDefinitionRegistry(defaultDefinition);

    expect(registry.get('unknownEdge')).toBe(defaultDefinition);
  });

  it('returns the registered edge definition when present', () => {
    const defaultDefinition = makeEdgeDefinition('default');
    const registry = new EdgeDefinitionRegistry(defaultDefinition);

    const blockArrow = makeEdgeDefinition('blockArrow');
    registry.register(blockArrow);

    expect(registry.get('blockArrow')).toBe(blockArrow);
  });

  it('lazy loads an edge definition matching a shape pattern', async () => {
    const defaultDefinition = makeEdgeDefinition('default');
    const lazyLoaders: Array<LazyElementLoaderEntry> = [
      {
        shapes: /^uml/,
        edgeDefinitionLoader: async () => async (registry: EdgeDefinitionRegistry) => {
          registry.register(makeEdgeDefinition('umlAssociation'));
        }
      }
    ];

    const registry = new EdgeDefinitionRegistry(defaultDefinition, lazyLoaders);

    expect(await registry.load('umlAssociation')).toBe(true);
    expect(registry.hasRegistration('umlAssociation')).toBe(true);
  });
});
