import { TbArrowsJoin } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { RelationPairGapsWidget } from './RelationPairGaps';
import { RelationPairGapsConfigForm } from './RelationPairGapsConfigForm';
import { relationPairGapsWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'RelationPairGaps',
  category: 'metrics',
  name: 'Pair coverage gaps',
  description:
    'Number of provider × consumer pairs around a shared entity that no chosen relation type connects.',
  icon: TbArrowsJoin,
  component: RelationPairGapsWidget,
  configForm: RelationPairGapsConfigForm,
  configSchema: relationPairGapsWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { padded: false, showIcon: false }
  }
});
