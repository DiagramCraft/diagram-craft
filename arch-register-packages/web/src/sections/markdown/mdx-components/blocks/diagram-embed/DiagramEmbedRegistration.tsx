import { TbChartLine } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { DiagramEmbed } from './DiagramEmbed';
import { DiagramEmbedWidget } from '../../../../dashboard/widgets/DiagramEmbedWidget';
import {
  DIAGRAM_EMBED_TYPE,
  DiagramEmbedEditable,
  diagramEmbedMdxRule
} from './DiagramEmbedEditable';
import type { DiagramEmbedSlateElement, DiagramEmbedWidgetConfig } from './types';

export const diagramEmbedSpec = defineMdxComponent<
  DiagramEmbedSlateElement,
  { id: string; caption?: string },
  'block'
>({
  component: DiagramEmbed,
  mode: 'block',
  allowedProps: ['id', 'caption'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbChartLine,
    label: 'Diagram',
    description: 'A read-only preview of a selected architecture diagram.',
    defaultW: 6,
    defaultH: 4,
    surfaces: ['workspace', 'project'],
    component: DiagramEmbedWidget,
    isValidConfig: (config): config is DiagramEmbedWidgetConfig =>
      typeof config.fileId === 'string' &&
      (config.caption === undefined || typeof config.caption === 'string'),
    createDefaultConfig: () => ({ fileId: '' }),
    getTitle: () => 'Diagram'
  },
  editorSpec: {
    editableComponent: DiagramEmbedEditable,
    nodeOptions: { isVoid: true },
    mdxRule: diagramEmbedMdxRule,
    slashCommand: {
      key: 'diagram-embed',
      label: 'Diagram Embed',
      description: 'Embed a read-only diagram preview',
      icon: <TbChartLine size={14} />,
      keywords: ['diagram', 'embed', 'preview', 'svg', 'flow'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: DIAGRAM_EMBED_TYPE,
          fileId: '',
          caption: '',
          children: [{ text: '' }]
        });
      }
    }
  }
});
