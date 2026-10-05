import type { ComponentType } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';

/**
 * Late-bound access to the widget registry and the widget renderer for container widgets (Tabs).
 * A container's spec is itself registered in `dashboardWidgetRegistry.ts`, and rendering its
 * children needs the registry and `DashboardWidgetRenderer` back, so importing them directly would
 * form an import cycle. The registry and the renderer register themselves here when loaded.
 */
type Resolvers = {
  getSpec?: (type: string) => DashboardWidgetSpec | undefined;
  getSpecs?: () => Array<{ type: string; spec: DashboardWidgetSpec }>;
  Renderer?: ComponentType<{ widget: DashboardWidget }>;
};

const resolvers: Resolvers = {};

export const registerNestedWidgetResolvers = (next: Resolvers): void => {
  Object.assign(resolvers, next);
};

export const getNestedWidgetSpec = (type: string): DashboardWidgetSpec | undefined =>
  resolvers.getSpec?.(type);

export const getNestedWidgetSpecs = (): Array<{ type: string; spec: DashboardWidgetSpec }> =>
  resolvers.getSpecs?.() ?? [];

export const NestedWidgetRenderer = ({ widget }: { widget: DashboardWidget }) => {
  const Renderer = resolvers.Renderer;
  return Renderer ? <Renderer widget={widget} /> : null;
};
