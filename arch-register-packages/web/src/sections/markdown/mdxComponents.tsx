import { EntityCardBlock } from './EntityCardBlock';

export const MDX_COMPONENTS: Record<string, React.ComponentType<{ id: string; fields?: string }>> = {
  EntityCard: EntityCardBlock,
};
