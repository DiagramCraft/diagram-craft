import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import { getDashboardWidgetSpec } from '../dashboardWidgetRegistry';
import { parseKnownDashboardWidget } from '../dashboardWidgetConfig';
import { getWidgetTitle } from '../dashboardWidgetDefaults';

type Props = {
  widget: DashboardWidget;
  isEditing?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const DashboardWidgetRenderer = ({ widget, isEditing = false, onEdit, onRemove }: Props) => {
  const knownWidget = parseKnownDashboardWidget(widget);
  const dashboardWidget = knownWidget ? getDashboardWidgetSpec(knownWidget.type) : undefined;
  const title = knownWidget ? (
    dashboardWidget?.titleComponent ? (
      <dashboardWidget.titleComponent config={knownWidget.config} />
    ) : (
      getWidgetTitle(knownWidget)
    )
  ) : (
    widget.type
  );
  const Icon = dashboardWidget?.icon;
  const HeaderActions = dashboardWidget?.headerActionsComponent;

  return (
    <WidgetFrame
      title={title}
      icon={Icon && dashboardWidget?.frame?.showIcon !== false && <Icon size={14} />}
      headerActions={HeaderActions && knownWidget && <HeaderActions config={knownWidget.config} />}
      padded={dashboardWidget?.frame?.padded !== false}
      bare={!!dashboardWidget?.frame?.hideOutsideEdit && !isEditing}
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
