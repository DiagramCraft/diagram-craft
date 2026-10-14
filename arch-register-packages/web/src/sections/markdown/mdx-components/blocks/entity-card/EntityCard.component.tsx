import { TbId } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityCard } from './EntityCard';
import { ENTITY_CARD_TYPE, EntityCardEditable, entityCardMdxRule } from './EntityCardEditable';
import { EntityCardConfigForm } from './EntityCardConfigForm';
import { entityCardWidgetConfigSchema } from './types';

export default defineComponent({
  type: ENTITY_CARD_TYPE,
  category: 'data-views',
  name: 'Entity card',
  description:
    'A summary card for one entity with its key fields. Use it to spotlight a single system or owner.',
  configSchema: entityCardWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['workspace', 'project']
  },
  component: EntityCard,
  configForm: EntityCardConfigForm,
  icon: TbId,
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
