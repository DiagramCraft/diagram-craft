import { describe, expect, it } from 'vitest';
import { createArtifactProcessorRegistry } from './artifactProcessor';

describe('artifact processor registry', () => {
  it('resolves processors by capability type and returns null for unhandled types', () => {
    const processor = {
      artifactType: 'example-capability',
      processRevision: async () => {
        throw new Error('not called');
      }
    } as const;
    const registry = createArtifactProcessorRegistry([processor]);

    expect(registry.get('example-capability')).toBe(processor);
    expect(registry.get('other-capability')).toBeNull();
  });
});
