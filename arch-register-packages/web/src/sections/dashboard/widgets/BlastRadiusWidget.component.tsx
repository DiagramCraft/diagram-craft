import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { BLAST_RADIUS_WIDGET_TYPE, blastRadiusDashboardSpec } from './BlastRadiusWidget';
export default defineComponent({
  type: BLAST_RADIUS_WIDGET_TYPE,
  category: 'visualizations',
  name: 'Blast radius',
  description: 'Entities reachable from a chosen entity, with depth and owner filters.',
  dashboardWidget: blastRadiusDashboardSpec
});
