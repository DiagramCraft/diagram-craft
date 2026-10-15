/**
 * Dashboard-only widget: a ranked list of entities of a chosen schema, sorted by a chosen numeric
 * (or derived-numeric) field - not tied to any particular schema or field name.
 */
import { TbListNumbers } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { TopEntitiesConfigForm } from './TopEntitiesConfigForm';
import { TopEntitiesWidget } from './TopEntities';
import { topEntitiesWidgetConfigSchema } from './types';
export default defineWidget({
  type: 'TopEntities',
  category: 'data-views',
  name: 'Ranked list',
  description: 'The top entities of a type, ranked by a numeric field.',
  icon: TbListNumbers,
  component: TopEntitiesWidget,
  configForm: TopEntitiesConfigForm,
  configSchema: topEntitiesWidgetConfigSchema,
  dashboard: {
    defaultW: 4,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  }
});
