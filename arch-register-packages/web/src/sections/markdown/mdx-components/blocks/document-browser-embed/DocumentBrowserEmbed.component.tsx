import { TbFileSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import {
  createDefaultDocumentBrowserEmbedConfig,
  decodeDocumentBrowserEmbedConfig
} from './DocumentBrowserEmbedCodec';
import {
  DOCUMENT_BROWSER_EMBED_TYPE,
  DocumentBrowserEmbedEditable,
  documentBrowserEmbedMdxRule
} from './DocumentBrowserEmbedEditable';
import { DocumentBrowserEmbedConfigForm } from './DocumentBrowserEmbedConfigForm';
import { schemaGuard } from '../../configSchema';
import {
  documentBrowserEmbedConfigSchema,
  type DocumentBrowserEmbedConfig,
  type DocumentBrowserEmbedSlateElement
} from './types';

export default defineComponent<DocumentBrowserEmbedSlateElement, { config?: string }, 'block'>({
  type: DOCUMENT_BROWSER_EMBED_TYPE,
  category: 'data-views',
  name: 'Document browser',
  description:
    'A filterable list of documents in this workspace or project. Use it to find and open files.',
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    isValidConfig: schemaGuard(documentBrowserEmbedConfigSchema),
    dialogWidth: 'min(1200px, 92vw)'
  },
  component: DocumentBrowserEmbed,
  createDefaultProps: () => ({ config: createDefaultDocumentBrowserEmbedConfig() }),
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
