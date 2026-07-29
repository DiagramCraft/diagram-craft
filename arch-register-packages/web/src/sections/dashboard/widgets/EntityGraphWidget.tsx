import { EntityGraph } from '../../markdown/mdx-components/blocks/entity-graph/EntityGraph';
import type { EntityGraphWidgetConfig } from '../../markdown/mdx-components/blocks/entity-graph/types';

type Props = {
  config: EntityGraphWidgetConfig;
};

export const EntityGraphWidget = ({ config }: Props) => (
  <EntityGraph
    id={config.entityId}
    depth={config.depth != null ? String(config.depth) : undefined}
    direction={config.direction}
  />
);
