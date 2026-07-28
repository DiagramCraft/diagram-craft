import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import { StatMetricWidget } from './StatMetricWidget';
import { SavedViewEmbedWidget } from './SavedViewEmbedWidget';
import { EntityTableWidget } from './EntityTableWidget';
import { LifecycleChartWidget } from './LifecycleChartWidget';
import { ActivityTrendChartWidget } from './ActivityTrendChartWidget';
import { StaleEntityReportWidget } from './StaleEntityReportWidget';
import { ActivityFeedWidget } from './ActivityFeedWidget';
import { ActiveAssessmentsWidget } from './ActiveAssessmentsWidget';
import { UpcomingMilestonesWidget } from './UpcomingMilestonesWidget';
import { parseKnownDashboardWidget } from '../dashboardWidgetConfig';

type Props = {
  widget: DashboardWidget;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const DashboardWidgetRenderer = ({ widget, onEdit, onRemove }: Props) => {
  const content = renderWidgetContent(widget);
  return (
    <WidgetFrame onEdit={onEdit} onRemove={onRemove}>
      {content}
    </WidgetFrame>
  );
};

const renderWidgetContent = (widget: DashboardWidget) => {
  const knownWidget = parseKnownDashboardWidget(widget);
  if (!knownWidget) {
    return (
      <div>
        Unsupported dashboard widget: <code>{widget.type}</code>
      </div>
    );
  }

  switch (knownWidget.type) {
    case 'stat-metric':
      return <StatMetricWidget widget={knownWidget} />;
    case 'saved-view-embed':
      return <SavedViewEmbedWidget widget={knownWidget} />;
    case 'entity-table':
      return <EntityTableWidget widget={knownWidget} />;
    case 'lifecycle-chart':
      return <LifecycleChartWidget />;
    case 'activity-trend-chart':
      return <ActivityTrendChartWidget widget={knownWidget} />;
    case 'stale-entity-report':
      return <StaleEntityReportWidget widget={knownWidget} />;
    case 'activity-feed':
      return <ActivityFeedWidget widget={knownWidget} />;
    case 'active-assessments':
      return <ActiveAssessmentsWidget />;
    case 'upcoming-milestones':
      return <UpcomingMilestonesWidget />;
  }
};
