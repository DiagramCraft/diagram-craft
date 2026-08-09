import type { TElement } from 'platejs';
import { TbListNumbers } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { TopEntitiesWidget, type TopEntitiesWidgetConfig } from './TopEntitiesWidget';
import { TopEntitiesConfigForm } from './TopEntitiesConfigForm';

export const TOP_ENTITIES_TYPE = 'TopEntities' as const;

const isDirection = (value: unknown): value is 'asc' | 'desc' =>
  value === 'asc' || value === 'desc';

interface TopEntitiesSlateElement extends TElement {}

/**
 * Dashboard-only widget: a ranked list of entities of a chosen schema, sorted by a chosen numeric
 * (or derived-numeric) field - not tied to any particular schema or field name.
 */
export const topEntitiesSpec = defineMdxComponent<
  TopEntitiesSlateElement,
  { config: TopEntitiesWidgetConfig },
  'block'
>({
  component: TopEntitiesWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbListNumbers,
    label: 'Ranked list',
    description: 'The top entities of a type, ranked by a numeric field.',
    defaultW: 4,
    defaultH: 4,
    surfaces: ['workspace', 'project'],
    component: TopEntitiesWidget,
    isValidConfig: (config): config is TopEntitiesWidgetConfig =>
      typeof config.schema === 'string' &&
      config.schema.length > 0 &&
      typeof config.fieldId === 'string' &&
      config.fieldId.length > 0 &&
      isDirection(config.direction) &&
      typeof config.limit === 'number' &&
      config.limit > 0 &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.label === undefined || typeof config.label === 'string'),
    createDefaultConfig: () => ({ schema: '', fieldId: '', direction: 'desc', limit: 5 }),
    getTitle: (config: TopEntitiesWidgetConfig) => config.label?.trim() || 'Ranked list',
    configForm: TopEntitiesConfigForm
  }
});
