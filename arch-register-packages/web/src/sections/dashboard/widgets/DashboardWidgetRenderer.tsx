import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import { StatMetricWidget } from './StatMetricWidget';
import { SavedViewEmbedWidget } from './SavedViewEmbedWidget';
import { EntityTableWidget } from './EntityTableWidget';
import { LifecycleChartWidget } from './LifecycleChartWidget';
import { ActivityTrendChartWidget } from './ActivityTrendChartWidget';
import { StaleEntityReportWidget } from './StaleEntityReportWidget';
import { ActivityFeedWidget } from './ActivityFeedWidget';

type Props = {
  widget: DashboardWidget;
};

export const DashboardWidgetRenderer = ({ widget }: Props) => {
  const content = renderWidgetContent(widget);
  return <WidgetFrame>{content}</WidgetFrame>;
};

const renderWidgetContent = (widget: DashboardWidget) => {
  switch (widget.type) {
    case 'stat-metric':
      return <StatMetricWidget widget={widget} />;
    case 'saved-view-embed':
      return <SavedViewEmbedWidget widget={widget} />;
    case 'entity-table':
      return <EntityTableWidget widget={widget} />;
    case 'lifecycle-chart':
      return <LifecycleChartWidget />;
    case 'activity-trend-chart':
      return <ActivityTrendChartWidget widget={widget} />;
    case 'stale-entity-report':
      return <StaleEntityReportWidget widget={widget} />;
    case 'activity-feed':
      return <ActivityFeedWidget widget={widget} />;
    default: {
      const _exhaustive: never = widget;
      return _exhaustive;
    }
  }
};
