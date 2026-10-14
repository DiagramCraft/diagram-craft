import { TbLayoutDashboard } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityViewEmbed } from './EntityViewEmbed';
import {
  ENTITY_VIEW_EMBED_TYPE,
  EntityViewEmbedEditable,
  entityViewEmbedMdxRule
} from './EntityViewEmbedEditable';
import { EntityViewEmbedConfigForm } from './EntityViewEmbedConfigForm';
import { savedViewEmbedWidgetConfigSchema } from './types';
export default defineComponent({
  type: ENTITY_VIEW_EMBED_TYPE,
  category: 'data-views',
  name: 'Saved view',
  description: 'A live copy of a saved entity view. Use it to reuse a view someone already set up.',
  configSchema: savedViewEmbedWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project']
  },
  component: EntityViewEmbed,
  createDefaultProps: context => ({ config: { viewId: context.viewId ?? '' } }),
  configForm: EntityViewEmbedConfigForm,
  icon: TbLayoutDashboard,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['viewId'],
    mapProps: props => ({ config: { viewId: props.viewId ?? '' } }),
    editorSpec: {
      editableComponent: EntityViewEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityViewEmbedMdxRule,
      slashCommand: {
        keywords: ['entity', 'view', 'embed', 'saved', 'catalog'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: ENTITY_VIEW_EMBED_TYPE,
            viewId: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
