import { TbLayoutDashboard, TbLayoutGrid } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityViewEmbed } from './EntityViewEmbed';
import {
  ENTITY_VIEW_EMBED_TYPE,
  EntityViewEmbedEditable,
  entityViewEmbedMdxRule
} from './EntityViewEmbedEditable';
import { EntityViewEmbedConfigForm } from './EntityViewEmbedConfigForm';
import type { EntityViewEmbedSlateElement, SavedViewEmbedWidgetConfig } from './types';
export default defineComponent<EntityViewEmbedSlateElement, { viewId?: string }, 'block'>({
  type: ENTITY_VIEW_EMBED_TYPE,
  category: 'data-views',
  name: 'Saved view',
  description: 'A live copy of a saved entity view. Use it to reuse a view someone already set up.',
  dashboardWidget: {
    icon: TbLayoutDashboard,
    defaultW: 6,
    defaultH: 24,
    surfaces: ['workspace', 'project'],
    isValidConfig: (config): config is SavedViewEmbedWidgetConfig =>
      typeof config.viewId === 'string' && config.viewId.length > 0
  },
  component: EntityViewEmbed,
  createDefaultProps: context => ({ config: { viewId: context.viewId ?? '' } }),
  configForm: EntityViewEmbedConfigForm,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['viewId'],
    mapProps: props => ({ config: { viewId: props.viewId ?? '' } }),
    editorSpec: {
      editableComponent: EntityViewEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityViewEmbedMdxRule,
      slashCommand: {
        icon: <TbLayoutGrid size={14} />,
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
