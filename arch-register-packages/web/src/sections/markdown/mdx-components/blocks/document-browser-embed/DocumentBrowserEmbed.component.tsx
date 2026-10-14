import { TbFileSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { decodeDocumentBrowserEmbedConfig } from './DocumentBrowserEmbedCodec';
import {
  DOCUMENT_BROWSER_EMBED_TYPE,
  DocumentBrowserEmbedEditable,
  documentBrowserEmbedMdxRule
} from './DocumentBrowserEmbedEditable';
import { DocumentBrowserEmbedConfigForm } from './DocumentBrowserEmbedConfigForm';
import { documentBrowserEmbedConfigSchema, type DocumentBrowserEmbedConfig } from './types';

export default defineComponent({
  type: DOCUMENT_BROWSER_EMBED_TYPE,
  category: 'data-views',
  name: 'Document browser',
  description:
    'A filterable list of documents in this workspace or project. Use it to find and open files.',
  configSchema: documentBrowserEmbedConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    dialogWidth: 'min(1200px, 92vw)'
  },
  component: DocumentBrowserEmbed,
  configForm: DocumentBrowserEmbedConfigForm,
  icon: TbFileSearch,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['config'],
    mapProps: (props, defaultProps) => ({
      ...defaultProps,
      config:
        decodeDocumentBrowserEmbedConfig(props.config) ??
        (defaultProps.config as DocumentBrowserEmbedConfig)
    }),
    editorSpec: {
      editableComponent: DocumentBrowserEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: documentBrowserEmbedMdxRule,
      slashCommand: {
        keywords: ['document', 'browser', 'markdown', 'wiki', 'list', 'filter', 'search'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: DOCUMENT_BROWSER_EMBED_TYPE,
            config: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
});
