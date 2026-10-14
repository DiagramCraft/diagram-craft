/**
 * Dashboard-only widget: a ranked list of entities of a chosen schema, sorted by a chosen numeric
 * (or derived-numeric) field - not tied to any particular schema or field name.
 */
import { TbListNumbers } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import type { TopEntitiesWidgetConfig } from './TopEntitiesWidget';
import {
  TOP_ENTITIES_TYPE,
  TopEntitiesConfigForm,
  TopEntitiesWidget,
  isDirection
} from './TopEntitiesWidget';
export default defineComponent({
  type: TOP_ENTITIES_TYPE,
  category: 'data-views',
  name: 'Ranked list',
  description: 'The top entities of a type, ranked by a numeric field.',
  dashboardWidget: {
    icon: TbListNumbers,
    defaultW: 4,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: TopEntitiesWidget,
    isValidConfig: (config): config is TopEntitiesWidgetConfig =>
      ((typeof config.schema === 'string' && config.schema.length > 0) ||
        (typeof config.schemaName === 'string' && config.schemaName.length > 0)) &&
      typeof config.fieldId === 'string' &&
      config.fieldId.length > 0 &&
      isDirection(config.direction) &&
      typeof config.limit === 'number' &&
      config.limit > 0 &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.showLink === undefined || typeof config.showLink === 'boolean') &&
      (config.showShareBar === undefined || typeof config.showShareBar === 'boolean'),
    createDefaultConfig: () => ({ schema: '', fieldId: '', direction: 'desc', limit: 5 }),
    configForm: TopEntitiesConfigForm
  }
});
