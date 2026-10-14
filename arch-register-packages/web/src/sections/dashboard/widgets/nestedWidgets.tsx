import type { ComponentType } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { WidgetSurface } from '../../markdown/mdx-components/types';

/**
 * Late-bound access to the widget renderer and tab-contents editor for container widgets (Tabs).
 * A container is itself registered through `componentDiscovery`, and rendering or editing its
 * children needs `DashboardWidgetRenderer` / `TabContentsEditor` back, so importing them directly
 * would form an import cycle. They register themselves here when loaded.
 */
export type TabContentsEditorProps = {
  widgets: DashboardWidget[];
  onChange: (widgets: DashboardWidget[]) => void;
  workspaceSlug: string;
  surface: WidgetSurface;
};

type Resolvers = {
  Renderer?: ComponentType<{ widget: DashboardWidget }>;
  TabContentsEditor?: ComponentType<TabContentsEditorProps>;
};

const resolvers: Resolvers = {};

export const registerNestedWidgetResolvers = (next: Resolvers): void => {
  Object.assign(resolvers, next);
};

export const NestedWidgetRenderer = ({ widget }: { widget: DashboardWidget }) => {
  const Renderer = resolvers.Renderer;
  return Renderer ? <Renderer widget={widget} /> : null;
};

export const NestedTabContentsEditor = (props: TabContentsEditorProps) => {
  const Editor = resolvers.TabContentsEditor;
  return Editor ? <Editor {...props} /> : null;
};
