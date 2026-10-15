import { TbChartLine } from 'react-icons/tb';
import { defineWidget } from '../../defineWidget';
import { DiagramEmbed } from './DiagramEmbed';
import {
  DIAGRAM_EMBED_TYPE,
  DiagramEmbedEditable,
  diagramEmbedMdxRule
} from './DiagramEmbedEditable';
import { DiagramEmbedConfigForm } from './DiagramEmbedConfigForm';
import { diagramEmbedWidgetConfigSchema } from './types';
export default defineWidget({
  type: DIAGRAM_EMBED_TYPE,
  category: 'visualizations',
  name: 'Diagram',
  description:
    'A read-only preview of an architecture diagram. Use it to show a system picture alongside the text.',
  configSchema: diagramEmbedWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  keywords: ['diagram', 'embed', 'preview', 'svg', 'flow'],
  component: DiagramEmbed,
  configForm: DiagramEmbedConfigForm,
  icon: TbChartLine,
  mdx: {
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
});
