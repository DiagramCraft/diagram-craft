import { TbChartLine } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { flatConfigCodec } from '../../shared/configSchema';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { DiagramEmbed } from './DiagramEmbed';
import { DiagramEmbedConfigForm } from './DiagramEmbedConfigForm';
import { diagramEmbedWidgetConfigSchema } from './types';

export default defineWidget({
  type: 'DiagramEmbed',
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
  mdx: configBlockMdx({
    codec: flatConfigCodec(diagramEmbedWidgetConfigSchema, {
      attributeNames: { fileId: 'id' }
    }),
    placeholder: 'Choose diagram…',
    fullWidth: true
  })
});
