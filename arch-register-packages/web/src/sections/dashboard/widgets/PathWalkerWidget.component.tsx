import { TbArrowsSplit2 } from 'react-icons/tb';
import { pathWalkerWidgetConfigSchema } from './pathWalkerWidgetLogic';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { PATH_WALKER_TYPE, PathWalkerConfigForm, PathWalkerWidget } from './PathWalkerWidget';

export default defineComponent({
  type: PATH_WALKER_TYPE,
  category: 'data-views',
  name: 'Relationship walker',
  description:
    'Walk from every entity of one type through a chain of relations, one column per hop.',
  icon: TbArrowsSplit2,
  component: PathWalkerWidget,
  configForm: PathWalkerConfigForm,
  configSchema: pathWalkerWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 12,
    defaultH: 22,
    surfaces: ['workspace']
  }
});
