import { TbLayoutDashboard, TbLayoutGrid } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityViewEmbed } from './EntityViewEmbed';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
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
    component: createDashboardWidgetAdapter(
      EntityViewEmbed,
      (config: SavedViewEmbedWidgetConfig) => ({
        viewId: config.viewId
      })
    ),
    isValidConfig: (config): config is SavedViewEmbedWidgetConfig =>
      typeof config.viewId === 'string' && config.viewId.length > 0,
    createDefaultConfig: context => ({ viewId: context.viewId ?? '' }),
    configForm: EntityViewEmbedConfigForm
  },
  mdxComponent: {
    component: EntityViewEmbed,
    mode: 'block',
    allowedProps: ['viewId'],
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
