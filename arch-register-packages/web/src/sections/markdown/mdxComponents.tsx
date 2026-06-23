import { EntityCardBlock } from './blocks/entity-card/EntityCardBlock';

// biome-ignore lint/suspicious/noExplicitAny: ok
export const MDX_COMPONENTS: Record<string, React.ComponentType<any>> = {
  EntityCard: EntityCardBlock
};
