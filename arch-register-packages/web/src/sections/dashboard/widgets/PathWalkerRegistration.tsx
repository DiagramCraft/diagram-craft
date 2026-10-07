import { TbArrowsSplit2 } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { PathWalkerConfigForm } from './PathWalkerConfigForm';
import { PathWalkerWidget } from './PathWalkerWidget';
import {
  isPathWalkerConfigComplete,
  isPathWalkerConfigValid,
  type PathWalkerWidgetConfig
} from './pathWalkerWidgetLogic';

export const PATH_WALKER_TYPE = 'PathWalker' as const;

export const pathWalkerSpec: DashboardWidgetSpec<PathWalkerWidgetConfig> = {
  icon: TbArrowsSplit2,
  label: 'Relationship walker',
  description:
    'Walk from every entity of one type through a chain of relations, one column per hop.',
  defaultW: 12,
  defaultH: 22,
  surfaces: ['workspace'],
  component: PathWalkerWidget,
  isValidConfig: (config): config is PathWalkerWidgetConfig =>
    isPathWalkerConfigValid(config) && isPathWalkerConfigComplete(config as PathWalkerWidgetConfig),
  createDefaultConfig: () => ({ rootSchemaName: '' }),
  getTitle: config => config.label?.trim() || 'Relationship walker',
  configForm: PathWalkerConfigForm
};
