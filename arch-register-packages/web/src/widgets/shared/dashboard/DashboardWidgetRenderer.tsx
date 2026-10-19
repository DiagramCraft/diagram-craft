import type { ReactNode } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import { getWidgetDefinition } from '../widgetRegistry';
import { parseKnownDashboardWidget } from '../../../sections/dashboard/dashboardWidgets';
import { getWidgetTitle } from '../../../sections/dashboard/dashboardWidgets';
import { useDashboardSidebarVariables } from '../../../sections/dashboard/DashboardSidebarContext';
import { resolveConfigVariables } from '../../../sections/dashboard/resolveSidebarVariableReferences';

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
  const definition = knownWidget ? getWidgetDefinition(knownWidget.type, 'dashboard') : undefined;
  const dashboard = definition?.dashboard;
  const WidgetComponent = definition?.component;
  const frame = resolveWidgetFrame(dashboard, widget.frame);

  const TitleComponent = dashboard?.titleComponent;
  let defaultTitle: ReactNode = widget.type;
  if (knownWidget) {
    defaultTitle = TitleComponent ? (
      <TitleComponent config={knownWidget.config} />
    ) : (
      getWidgetTitle(knownWidget)
    );
  }
  const title = frame.title ?? defaultTitle;
  const Icon = frame.iconName ? resolveAppIcon(frame.iconName) : definition?.icon;
  const HeaderActions = dashboard?.headerActionsComponent;

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
      {knownWidget && WidgetComponent ? (
        <WidgetBodyTitleProvider value={!frame.showFrame && !isEditing ? frame.title : undefined}>
          <WidgetComponent config={knownWidget.config} />
        </WidgetBodyTitleProvider>
      ) : (
        <div>
          Unsupported dashboard widget: <code>{widget.type}</code>
        </div>
      )}
    </WidgetFrame>
  );
};
