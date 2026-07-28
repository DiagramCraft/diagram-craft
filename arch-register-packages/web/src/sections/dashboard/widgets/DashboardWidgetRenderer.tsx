import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import { getDashboardWidgetSpec } from '../../markdown/mdx-components/mdxRegistry';
import { parseKnownDashboardWidget } from '../dashboardWidgetConfig';
import { getWidgetTitle } from '../dashboardWidgetDefaults';

type Props = {
  widget: DashboardWidget;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const DashboardWidgetRenderer = ({ widget, onEdit, onRemove }: Props) => {
  const knownWidget = parseKnownDashboardWidget(widget);
  const dashboardWidget = knownWidget ? getDashboardWidgetSpec(knownWidget.type) : undefined;
  const title = knownWidget ? getWidgetTitle(knownWidget) : widget.type;
  const Icon = dashboardWidget?.icon;

  return (
    <WidgetFrame
      title={title}
      icon={Icon && <Icon size={14} />}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      {knownWidget && dashboardWidget ? (
        <dashboardWidget.component config={knownWidget.config} />
      ) : (
        <div>
          Unsupported dashboard widget: <code>{widget.type}</code>
        </div>
      )}
    </WidgetFrame>
  );
};
