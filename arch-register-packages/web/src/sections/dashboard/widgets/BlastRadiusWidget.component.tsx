import { TbTopologyStar3 } from 'react-icons/tb';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  BLAST_RADIUS_WIDGET_TYPE,
  BlastRadiusConfigForm,
  BlastRadiusWidget,
  blastRadiusWidgetConfigSchema
} from './BlastRadiusWidget';

export default defineComponent({
  type: BLAST_RADIUS_WIDGET_TYPE,
  category: 'visualizations',
  name: 'Blast radius',
  description: 'Entities reachable from a chosen entity, with depth and owner filters.',
  icon: TbTopologyStar3,
  component: BlastRadiusWidget,
  createDefaultProps: () => ({ config: {} }),
  configForm: BlastRadiusConfigForm,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    // BlastRadiusPanel renders its own page-level padding (`.panel` in BlastRadiusPanel.module.css)
    // since it's shared with non-widget contexts (the entity drawer); WidgetFrame's own padding on
    // top of that doubled up the spacing, so it's turned off here.
    frame: { padded: false },
    isValidConfig: schemaGuard(blastRadiusWidgetConfigSchema)
  }
});
