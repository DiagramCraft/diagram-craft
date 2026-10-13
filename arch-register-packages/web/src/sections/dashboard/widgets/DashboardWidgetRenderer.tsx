import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import { getDashboardWidgetSpec } from '../dashboardWidgetRegistry';
import { parseKnownDashboardWidget } from '../dashboardWidgetConfig';
import { getWidgetTitle } from '../dashboardWidgetDefaults';
import { useDashboardSidebarVariables } from '../DashboardSidebarContext';
import { resolveConfigVariables } from '../resolveSidebarVariableReferences';

import { registerNestedWidgetResolvers } from './nestedWidgets';
import { WidgetBodyTitleProvider } from './WidgetBodyTitle';
import { resolveWidgetFrame } from './widgetFrameSettings';
import { resolveAppIcon } from '../../../shell/appIcons';

type Props = {
  widget: DashboardWidget;
  isEditing?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const DashboardWidgetRenderer = ({ widget, isEditing = false, onEdit, onRemove }: Props) => {
  const sidebarVariables = useDashboardSidebarVariables();
  const parsedWidget = parseKnownDashboardWidget(widget);
  const knownWidget = parsedWidget
    ? { ...parsedWidget, config: resolveConfigVariables(parsedWidget.config, sidebarVariables) }
    : null;
  const dashboardWidget = knownWidget ? getDashboardWidgetSpec(knownWidget.type) : undefined;
  const frame = resolveWidgetFrame(
    dashboardWidget,
    widget.frame,
    knownWidget?.config ?? widget.config
  );
  const title =
    frame.title ??
    (knownWidget ? (
      dashboardWidget?.titleComponent ? (
        <dashboardWidget.titleComponent config={knownWidget.config} />
      ) : (
        getWidgetTitle(knownWidget)
      )
    ) : (
      widget.type
    ));
  const Icon = frame.iconName ? resolveAppIcon(frame.iconName) : dashboardWidget?.icon;
  const HeaderActions = dashboardWidget?.headerActionsComponent;

  return (
    <WidgetFrame
      title={title}
      icon={Icon && frame.showIcon && <Icon size={14} />}
      headerActions={HeaderActions && knownWidget && <HeaderActions config={knownWidget.config} />}
      padded={frame.padded}
      bare={!frame.showFrame && !isEditing}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      {knownWidget && dashboardWidget ? (
        <WidgetBodyTitleProvider value={!frame.showFrame && !isEditing ? frame.title : undefined}>
          <dashboardWidget.component config={knownWidget.config} />
        </WidgetBodyTitleProvider>
      ) : (
        <div>
          Unsupported dashboard widget: <code>{widget.type}</code>
        </div>
      )}
    </WidgetFrame>
  );
};

registerNestedWidgetResolvers({ Renderer: DashboardWidgetRenderer });
