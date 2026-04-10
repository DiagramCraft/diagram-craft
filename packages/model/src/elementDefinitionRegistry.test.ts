import { describe, expect, it, vi } from 'vitest';
import { type NodeDefinition, NodeDefinitionRegistry } from './elementDefinitionRegistry';
import { CustomPropertyDefinition } from './elementDefinitionRegistry';
import { PathList } from '@diagram-craft/geometry/pathList';

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
});
