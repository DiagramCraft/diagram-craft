import { TbFileSearch } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import { configBlockMdx } from '../../shared/mdx/configBlock';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { documentBrowserEmbedCodec } from './DocumentBrowserEmbedCodec';
import { DocumentBrowserEmbedConfigForm } from './DocumentBrowserEmbedConfigForm';
import { documentBrowserEmbedConfigSchema } from './types';

export default defineWidget({
  type: 'DocumentBrowserEmbed',
  category: 'data-views',
  name: 'Document browser',
  description:
    'A filterable list of documents in this workspace or project. Use it to find and open files.',
  configSchema: documentBrowserEmbedConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  configDialog: { width: 'min(1200px, 92vw)' },
  keywords: ['document', 'browser', 'markdown', 'wiki', 'list', 'filter', 'search'],
  component: DocumentBrowserEmbed,
  configForm: DocumentBrowserEmbedConfigForm,
  icon: TbFileSearch,
  mdx: configBlockMdx({
    codec: documentBrowserEmbedCodec.codec,
    placeholder: 'Configure a document browser…',
    fullWidth: true
  })
});
