import { TbChartLine } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { DiagramEmbed } from './DiagramEmbed';
import {
  DIAGRAM_EMBED_TYPE,
  DiagramEmbedEditable,
  diagramEmbedMdxRule
} from './DiagramEmbedEditable';
import { DiagramEmbedConfigForm } from './DiagramEmbedConfigForm';
import { diagramEmbedWidgetConfigSchema } from './types';
export default defineComponent({
  type: DIAGRAM_EMBED_TYPE,
  category: 'visualizations',
  name: 'Diagram',
  description:
    'A read-only preview of an architecture diagram. Use it to show a system picture alongside the text.',
  configSchema: diagramEmbedWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  component: DiagramEmbed,
  createDefaultProps: () => ({ config: { fileId: '' } }),
  configForm: DiagramEmbedConfigForm,
  icon: TbChartLine,
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
});
