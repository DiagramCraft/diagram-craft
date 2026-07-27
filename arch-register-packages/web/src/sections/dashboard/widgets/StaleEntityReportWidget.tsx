import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityStaleReport } from '../../markdown/mdx-components/blocks/entity-stale-report/EntityStaleReport';

type Props = {
  widget: Extract<DashboardWidget, { type: 'stale-entity-report' }>;
};

export const StaleEntityReportWidget = ({ widget }: Props) => (
  <EntityStaleReport staleAfterDays={widget.staleAfterDays} />
);
