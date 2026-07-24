import type { LazyElementLoaderEntry } from './lazyElementLoader';

export interface MissingDefinitionReporter {
  report(type: string): void;
}

export class WarnOnceMissingDefinitionReporter implements MissingDefinitionReporter {
  private readonly reported = new Set<string>();

  report(type: string): void {
    if (this.reported.has(type)) return;
    this.reported.add(type);
    console.warn(`Cannot find shape '${type}'`, new Error().stack);
  }
}

export class NoopMissingDefinitionReporter implements MissingDefinitionReporter {
  report(_type: string): void {}
}

export abstract class AbstractDefinitionRegistry<T extends { type: string }> {
  private readonly definitions = new Map<string, T>();

  protected constructor(private readonly lazyLoaders: ReadonlyArray<LazyElementLoaderEntry> = []) {}

  list() {
    return this.definitions.keys();
  }

  register(definition: T): T {
    this.definitions.set(definition.type, definition);
    return definition;
  }

  hasRegistration(type: string): boolean {
    return this.definitions.has(type);
  }

  protected getRegistration(type: string): T | undefined {
    return this.definitions.get(type);
  }

  async load(type: string): Promise<boolean> {
    if (this.hasRegistration(type)) return true;

    const entry = this.lazyLoaders.find(e => e.shapes.test(type));
    if (!entry) return false;

    const loader = await this.resolveLoader(entry, type);
    await loader(this);

    return true;
  }

  protected abstract resolveLoader(
    entry: LazyElementLoaderEntry,
    type: string
  ): Promise<(registry: this) => Promise<void>>;
}
