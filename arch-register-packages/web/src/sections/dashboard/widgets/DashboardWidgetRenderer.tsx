import type { ReactNode } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { WidgetFrame } from './WidgetFrame';
import '../dashboardWidgetRegistry';
import { getComponentDefinition } from '../../markdown/mdx-components/componentRegistry';
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
  const definition = knownWidget
    ? getComponentDefinition(knownWidget.type, 'dashboardWidget')
    : undefined;
  const dashboardWidget = definition?.dashboardWidget;
  const WidgetComponent = definition?.component;
  const frame = resolveWidgetFrame(
    dashboardWidget,
    widget.frame,
    knownWidget?.config ?? widget.config
  );

  const TitleComponent = dashboardWidget?.titleComponent;
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

registerNestedWidgetResolvers({ Renderer: DashboardWidgetRenderer });
