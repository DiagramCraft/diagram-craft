import { EntityCardBlock } from './blocks/entity-card/EntityCardBlock';
import { EntityFieldInline } from './inlines/entity-field/EntityFieldInline';

// biome-ignore lint/suspicious/noExplicitAny: ok
export const MDX_COMPONENTS: Record<string, React.ComponentType<any>> = {
  EntityCard: EntityCardBlock,
  EntityField: EntityFieldInline,
};
