import { TbLayoutDashboard, TbLayoutGrid } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityViewEmbed } from './EntityViewEmbed';
import { SavedViewEmbedWidget } from '../../../../dashboard/widgets/SavedViewEmbedWidget';
import {
  ENTITY_VIEW_EMBED_TYPE,
  EntityViewEmbedEditable,
  entityViewEmbedMdxRule
} from './EntityViewEmbedEditable';
import { EntityViewEmbedDashboardConfigForm } from './EntityViewEmbedDashboardConfigForm';
import type { EntityViewEmbedSlateElement, SavedViewEmbedWidgetConfig } from './types';

export const entityViewEmbedSpec = defineMdxComponent<
  EntityViewEmbedSlateElement,
  { viewId?: string },
  'block'
>({
  component: EntityViewEmbed,
  mode: 'block',
  allowedProps: ['viewId'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbLayoutDashboard,
    label: 'Saved view',
    description: 'Embed one of the workspace saved views.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace', 'project'],
    component: SavedViewEmbedWidget,
    isValidConfig: (config): config is SavedViewEmbedWidgetConfig =>
      typeof config.viewId === 'string' && config.viewId.length > 0,
    createDefaultConfig: context => ({ viewId: context.viewId ?? '' }),
    configForm: EntityViewEmbedDashboardConfigForm
  },
  editorSpec: {
    editableComponent: EntityViewEmbedEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityViewEmbedMdxRule,
    slashCommand: {
      key: 'entity-view-embed',
      label: 'Entity View',
      description: 'Embed a live entity view from a saved view',
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
});
