import { assert } from '@diagram-craft/utils/assert';
import type { NodeDefinition } from './nodeDefinition';
import type { LazyElementLoaderEntry, NodeDefinitionLoader } from './lazyElementLoader';
import {
  AbstractDefinitionRegistry,
  MissingDefinitionReporter,
  WarnOnceMissingDefinitionReporter
} from './abstractDefinitionRegistry';

export class NodeDefinitionRegistry extends AbstractDefinitionRegistry<NodeDefinition> {
  constructor(
    lazyLoaders: ReadonlyArray<LazyElementLoaderEntry> = [],
    private readonly missingDefinitionReporter: MissingDefinitionReporter = new WarnOnceMissingDefinitionReporter()
  ) {
    super(lazyLoaders);
  }

  protected async resolveLoader(
    entry: LazyElementLoaderEntry,
    type: string
  ): Promise<NodeDefinitionLoader> {
    assert.present(entry.nodeDefinitionLoader, `No node definition loader for ${type}`);
    return entry.nodeDefinitionLoader();
  }

  get(type: string): NodeDefinition {
    const r = this.getRegistration(type);
    if (r) return r;

    this.missingDefinitionReporter.report(type);

    const fallback = this.getRegistration('rect');
    assert.present(fallback, `Not found: ${type}`);
    return fallback;
  }
}
