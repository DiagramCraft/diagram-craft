import '../markdown/mdx-components/componentRegistrations';
import {
  getComponentDefinition,
  getComponentDefinitions
} from '../markdown/mdx-components/componentRegistry';
import { registerNestedWidgetResolvers } from './widgets/nestedWidgets';

registerNestedWidgetResolvers({
  getSpec: type => getComponentDefinition(type, 'dashboardWidget')?.dashboardWidget,
  getSpecs: () =>
    getComponentDefinitions('dashboardWidget').map(({ type, dashboardWidget }) => ({
      type,
      spec: dashboardWidget
    }))
});
