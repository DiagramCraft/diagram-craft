import { TbArrowsSplit2 } from 'react-icons/tb';
import { pathWalkerWidgetConfigSchema } from './pathWalkerWidgetLogic';
import { defineWidget } from '../../shared/defineWidget';
import { PathWalkerConfigForm, PathWalkerWidget } from './PathWalker';

export default defineWidget({
  type: 'PathWalker',
  category: 'data-views',
  name: 'Relationship walker',
  description:
    'Walk from every entity of one type through a chain of relations, one column per hop.',
  icon: TbArrowsSplit2,
  component: PathWalkerWidget,
  configForm: PathWalkerConfigForm,
  configSchema: pathWalkerWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 22,
    surfaces: ['workspace']
  }
});
