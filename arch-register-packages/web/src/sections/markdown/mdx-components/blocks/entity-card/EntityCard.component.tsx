import { TbId } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityCard } from './EntityCard';
import { ENTITY_CARD_TYPE, EntityCardEditable, entityCardMdxRule } from './EntityCardEditable';
import { EntityCardConfigForm } from './EntityCardConfigForm';
import type { EntityCardSlateElement, EntityCardWidgetConfig } from './types';

const hasOptionalString = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || typeof config[key] === 'string';
export default defineComponent<EntityCardSlateElement, { id: string; fields?: string }, 'block'>({
  type: ENTITY_CARD_TYPE,
  category: 'data-views',
  name: 'Entity card',
  description:
    'A summary card for one entity with its key fields. Use it to spotlight a single system or owner.',
  dashboardWidget: {
    icon: TbId,
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project'],
    isValidConfig: (config): config is EntityCardWidgetConfig =>
      typeof config.entityId === 'string' &&
      config.entityId.length > 0 &&
      hasOptionalString(config, 'fields')
  },
  component: EntityCard,
  createDefaultProps: () => ({ config: { entityId: '' } }),
  configForm: EntityCardConfigForm,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['id', 'fields'],
    mapProps: props => ({
      config: { entityId: props.id ?? '', fields: props.fields }
    }),
    editorSpec: {
      editableComponent: EntityCardEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityCardMdxRule,
      slashCommand: {
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
  }
});
