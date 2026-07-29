import { EntityCard } from '../../markdown/mdx-components/blocks/entity-card/EntityCard';
import type { EntityCardWidgetConfig } from '../../markdown/mdx-components/blocks/entity-card/types';

type Props = {
  config: EntityCardWidgetConfig;
};

export const EntityCardWidget = ({ config }: Props) => (
  <EntityCard id={config.entityId} fields={config.fields} />
);
