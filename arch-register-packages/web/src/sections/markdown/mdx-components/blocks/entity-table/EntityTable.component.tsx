import { TbTable } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityTable } from './EntityTable';
import { ENTITY_TABLE_TYPE, EntityTableEditable, entityTableMdxRule } from './EntityTableEditable';
import { EntityTableConfigForm } from './EntityTableConfigForm';
import type { EntityTableSlateElement } from './types';
import { schemaGuard } from '../../configSchema';
import { entityTableWidgetConfigSchema } from './types';

export default defineComponent<
  EntityTableSlateElement,
  { schema?: string; owner?: string; lifecycle?: string; limit?: string },
  'block'
>({
  type: ENTITY_TABLE_TYPE,
  category: 'data-views',
  name: 'Entity table',
  description:
    'A table of entities matching filters you define. Use it for a fixed, readable list.',
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    isValidConfig: schemaGuard(entityTableWidgetConfigSchema)
  },
  component: EntityTable,
  createDefaultProps: () => ({ config: {} }),
  configForm: EntityTableConfigForm,
  icon: TbTable,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['schema', 'owner', 'lifecycle', 'limit'],
    mapProps: props => ({
      config: {
        schema: props.schema,
        owner: props.owner,
        lifecycle: props.lifecycle,
        limit: props.limit === undefined ? undefined : Number(props.limit)
      }
    }),
    editorSpec: {
      editableComponent: EntityTableEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityTableMdxRule,
      slashCommand: {
        keywords: ['entity', 'table', 'catalog', 'list', 'filter'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: ENTITY_TABLE_TYPE,
            schema: '',
            owner: '',
            lifecycle: '',
            limit: '10',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
