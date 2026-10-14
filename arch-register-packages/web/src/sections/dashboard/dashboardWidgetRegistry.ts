import '../markdown/mdx-components/componentRegistrations';
import {
  getDashboardWidgetSpec as getCatalogDashboardWidgetSpec,
  getDashboardWidgetSpecs as getCatalogDashboardWidgetSpecs
} from '../markdown/mdx-components/componentRegistry';
import { registerNestedWidgetResolvers } from './widgets/nestedWidgets';

export const getDashboardWidgetSpecs = getCatalogDashboardWidgetSpecs;
export const getDashboardWidgetSpec = getCatalogDashboardWidgetSpec;

registerNestedWidgetResolvers({
  getSpec: getDashboardWidgetSpec,
  getSpecs: getDashboardWidgetSpecs
});
