import { EntityTable } from '../../markdown/mdx-components/blocks/entity-table/EntityTable';
import type { EntityTableWidgetConfig } from '../../markdown/mdx-components/blocks/entity-table/types';

type Props = {
  config: EntityTableWidgetConfig;
};

export const EntityTableWidget = ({ config }: Props) => (
  <EntityTable
    schema={config.schema}
    owner={config.owner}
    lifecycle={config.lifecycle}
    limit={config.limit != null ? String(config.limit) : undefined}
  />
);
