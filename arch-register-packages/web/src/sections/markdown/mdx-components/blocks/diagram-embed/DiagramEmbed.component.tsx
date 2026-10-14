import { TbChartLine } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { DiagramEmbed } from './DiagramEmbed';
import {
  DIAGRAM_EMBED_TYPE,
  DiagramEmbedEditable,
  diagramEmbedMdxRule
} from './DiagramEmbedEditable';
import { DiagramEmbedConfigForm } from './DiagramEmbedConfigForm';
import type { DiagramEmbedSlateElement, DiagramEmbedWidgetConfig } from './types';
export default defineComponent<DiagramEmbedSlateElement, { id: string; caption?: string }, 'block'>(
  {
    type: DIAGRAM_EMBED_TYPE,
    category: 'visualizations',
    name: 'Diagram',
    description:
      'A read-only preview of an architecture diagram. Use it to show a system picture alongside the text.',
    dashboardWidget: {
      icon: TbChartLine,
      defaultW: 6,
      defaultH: 16,
      surfaces: ['workspace', 'project'],
      isValidConfig: (config): config is DiagramEmbedWidgetConfig =>
        typeof config.fileId === 'string' &&
        config.fileId.length > 0 &&
        (config.caption === undefined || typeof config.caption === 'string')
    },
    component: DiagramEmbed,
    createDefaultProps: () => ({ config: { fileId: '' } }),
    configForm: DiagramEmbedConfigForm,
    mdxComponent: {
      mode: 'block',
      allowedProps: ['id', 'caption'],
      mapProps: props => ({
        config: { fileId: props.id ?? '', caption: props.caption }
      }),
      editorSpec: {
        editableComponent: DiagramEmbedEditable,
        nodeOptions: { isVoid: true },
        mdxRule: diagramEmbedMdxRule,
        slashCommand: {
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
    }
  }
);
