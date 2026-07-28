import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityTable } from '../../markdown/mdx-components/blocks/entity-table/EntityTable';
import type { EntityTableWidgetConfig } from '../dashboardWidgetConfig';

type Props = {
  widget: DashboardWidget & { type: 'entity-table'; config: EntityTableWidgetConfig };
};

export const EntityTableWidget = ({ widget }: Props) => (
  <EntityTable
    schema={widget.config.schema}
    owner={widget.config.owner}
    lifecycle={widget.config.lifecycle}
    limit={widget.config.limit != null ? String(widget.config.limit) : undefined}
  />
);
