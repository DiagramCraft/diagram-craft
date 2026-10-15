import { TbAlertTriangle } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { CaseCountWidget } from './CaseCount';
import { CaseCountConfigForm } from './CaseCountConfigForm';
import { caseCountWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'CaseCount',
  category: 'metrics',
  name: 'Case count',
  description:
    'Number of open governance cases against entities of a chosen type, filtered by case kind and scope.',
  icon: TbAlertTriangle,
  component: CaseCountWidget,
  configForm: CaseCountConfigForm,
  configSchema: caseCountWidgetConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    frame: { hideOutsideEdit: true, padded: false, showIcon: false }
  }
});
