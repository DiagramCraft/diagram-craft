import { TbFileSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { configBlockMdx } from '../configBlock';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { documentBrowserEmbedCodec } from './DocumentBrowserEmbedCodec';
import { DocumentBrowserEmbedConfigForm } from './DocumentBrowserEmbedConfigForm';
import { documentBrowserEmbedConfigSchema } from './types';

export default defineComponent({
  type: 'DocumentBrowserEmbed',
  category: 'data-views',
  name: 'Document browser',
  description:
    'A filterable list of documents in this workspace or project. Use it to find and open files.',
  configSchema: documentBrowserEmbedConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  configDialog: { width: 'min(1200px, 92vw)' },
  component: DocumentBrowserEmbed,
  configForm: DocumentBrowserEmbedConfigForm,
  icon: TbFileSearch,
  mdxComponent: configBlockMdx({
    type: 'DocumentBrowserEmbed',
    codec: documentBrowserEmbedCodec.codec,
    placeholder: 'Configure a document browser…',
    fullWidth: true,
    keywords: ['document', 'browser', 'markdown', 'wiki', 'list', 'filter', 'search']
  })
});
