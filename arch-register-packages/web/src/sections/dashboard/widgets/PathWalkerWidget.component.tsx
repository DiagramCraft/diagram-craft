import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { PATH_WALKER_TYPE, _pathWalkerSpecData } from './PathWalkerWidget';

const { component, configForm, createDefaultProps, ...dashboardWidget } = _pathWalkerSpecData;
export default defineComponent({
  type: PATH_WALKER_TYPE,
  category: 'data-views',
  name: 'Relationship walker',
  description:
    'Walk from every entity of one type through a chain of relations, one column per hop.',
  component: component!,
  configForm,
  createDefaultProps,
  dashboardWidget
});
