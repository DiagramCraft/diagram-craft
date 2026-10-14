import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { BLAST_RADIUS_WIDGET_TYPE, blastRadiusDashboardSpec } from './BlastRadiusWidget';

const { icon, component, configForm, createDefaultProps, ...dashboardWidget } = blastRadiusDashboardSpec;
export default defineComponent({
  type: BLAST_RADIUS_WIDGET_TYPE,
  category: 'visualizations',
  name: 'Blast radius',
  description: 'Entities reachable from a chosen entity, with depth and owner filters.',
  component: component!,
  configForm,
  createDefaultProps,
  icon,
  dashboardWidget
});
