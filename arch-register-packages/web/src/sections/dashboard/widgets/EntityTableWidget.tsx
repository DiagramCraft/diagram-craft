import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityTable } from '../../markdown/mdx-components/blocks/entity-table/EntityTable';

type Props = {
  widget: Extract<DashboardWidget, { type: 'entity-table' }>;
};

export const EntityTableWidget = ({ widget }: Props) => (
  <EntityTable
    schema={widget.schema}
    owner={widget.owner}
    lifecycle={widget.lifecycle}
    limit={widget.limit != null ? String(widget.limit) : undefined}
  />
);
