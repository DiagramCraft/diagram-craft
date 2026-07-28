import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityStaleReport } from '../../markdown/mdx-components/blocks/entity-stale-report/EntityStaleReport';
import type { StaleEntityReportWidgetConfig } from '../dashboardWidgetConfig';

type Props = {
  widget: DashboardWidget & {
    type: 'stale-entity-report';
    config: StaleEntityReportWidgetConfig;
  };
};

export const StaleEntityReportWidget = ({ widget }: Props) => (
  <EntityStaleReport staleAfterDays={widget.config.staleAfterDays} />
);
