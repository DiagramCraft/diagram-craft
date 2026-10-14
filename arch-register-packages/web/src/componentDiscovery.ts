import type { ComponentDefinition } from './sections/markdown/mdx-components/types';
import { registerComponentDefinitions } from './sections/markdown/mdx-components/componentRegistry';

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const componentDefinitions = Object.values(
  import.meta.glob<ComponentDefinition>('./**/*.component.tsx', {
    eager: true,
    import: 'default'
  })
).sort((left, right) => compare(left.name, right.name) || compare(left.type, right.type));

registerComponentDefinitions(componentDefinitions);
