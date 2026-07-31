import { TbId } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityCard } from './EntityCard';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { ENTITY_CARD_TYPE, EntityCardEditable, entityCardMdxRule } from './EntityCardEditable';
import { EntityCardConfigForm } from './EntityCardConfigForm';
import type { EntityCardSlateElement, EntityCardWidgetConfig } from './types';

const hasOptionalString = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || typeof config[key] === 'string';

export const entityCardSpec = defineMdxComponent<
  EntityCardSlateElement,
  { id: string; fields?: string },
  'block'
>({
  component: EntityCard,
  mode: 'block',
  allowedProps: ['id', 'fields'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbId,
    label: 'Entity card',
    description: 'A focused summary card for a single entity.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['workspace', 'project'],
    component: createDashboardWidgetAdapter(EntityCard, (config: EntityCardWidgetConfig) => ({
      id: config.entityId,
      fields: config.fields
    })),
    isValidConfig: (config): config is EntityCardWidgetConfig =>
      typeof config.entityId === 'string' &&
      config.entityId.length > 0 &&
      hasOptionalString(config, 'fields'),
    createDefaultConfig: () => ({ entityId: '' }),
    getTitle: () => 'Entity card',
    configForm: EntityCardConfigForm
  },
  editorSpec: {
    editableComponent: EntityCardEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityCardMdxRule,
    slashCommand: {
      key: 'entity-card',
      label: 'Entity Card',
      description: 'Embed entity metadata inline',
      icon: <TbId size={14} />,
      keywords: ['entity', 'card', 'catalog', 'service'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_CARD_TYPE,
          entityId: '',
          children: [{ text: '' }]
        });
      }
    }
  }
});
