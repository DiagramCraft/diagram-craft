/**
 * Dashboard-only widget: a ranked list of entities of a chosen schema, sorted by a chosen numeric
 * (or derived-numeric) field - not tied to any particular schema or field name.
 */
import { TbListNumbers } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import {
  TOP_ENTITIES_TYPE,
  TopEntitiesConfigForm,
  TopEntitiesWidget,
  topEntitiesWidgetConfigSchema
} from './TopEntitiesWidget';
import { schemaGuard } from '../../markdown/mdx-components/configSchema';
export default defineComponent({
  type: TOP_ENTITIES_TYPE,
  category: 'data-views',
  name: 'Ranked list',
  description: 'The top entities of a type, ranked by a numeric field.',
  icon: TbListNumbers,
  component: TopEntitiesWidget,
  createDefaultProps: () => ({ config: { schema: '', fieldId: '', direction: 'desc', limit: 5 } }),
  configForm: TopEntitiesConfigForm,
  dashboardWidget: {
    defaultW: 4,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    isValidConfig: schemaGuard(topEntitiesWidgetConfigSchema)
  }
});
