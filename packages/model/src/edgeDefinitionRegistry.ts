import { assert } from '@diagram-craft/utils/assert';
import type { EdgeDefinition } from './edgeDefinition';
import type { EdgeDefinitionLoader, LazyElementLoaderEntry } from './lazyElementLoader';
import { AbstractDefinitionRegistry } from './abstractDefinitionRegistry';

export class EdgeDefinitionRegistry extends AbstractDefinitionRegistry<EdgeDefinition> {
  constructor(
    private readonly defaultValue: EdgeDefinition,
    lazyLoaders: ReadonlyArray<LazyElementLoaderEntry> = []
  ) {
    super(lazyLoaders);
  }

  protected async resolveLoader(
    entry: LazyElementLoaderEntry,
    type: string
  ): Promise<EdgeDefinitionLoader> {
    assert.present(entry.edgeDefinitionLoader, `No edge definition loader for ${type}`);
    return entry.edgeDefinitionLoader();
  }

  get(type: string): EdgeDefinition {
    const r = this.getRegistration(type) ?? this.defaultValue;
    assert.present(r);
    return r;
  }
}
