import { TbFileSearch } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import { encodeDocumentBrowserEmbedConfig } from './DocumentBrowserEmbedCodec';
import {
  DOCUMENT_BROWSER_EMBED_TYPE,
  DocumentBrowserEmbedEditable,
  documentBrowserEmbedMdxRule
} from './DocumentBrowserEmbedEditable';
import { DocumentBrowserEmbedConfigForm } from './DocumentBrowserEmbedConfigForm';
import { DOCUMENT_BROWSER_BASE_COLUMN_IDS } from './types';
import type { DocumentBrowserEmbedConfig, DocumentBrowserEmbedSlateElement } from './types';

const isDocumentBrowserEmbedConfig = (
  config: Record<string, unknown>
): config is DocumentBrowserEmbedConfig =>
  typeof config.q === 'string' &&
  Array.isArray(config.conditions) &&
  typeof config.sort === 'string' &&
  (config.sortDir === 'asc' || config.sortDir === 'desc') &&
  Array.isArray(config.visibleBaseColumnIds) &&
  Array.isArray(config.visibleFieldIds);

export const documentBrowserEmbedSpec = defineComponent<
  DocumentBrowserEmbedSlateElement,
  { config?: string },
  'block'
>({
  type: DOCUMENT_BROWSER_EMBED_TYPE,
  category: 'data-views',
  name: 'Document browser',
  description:
    'A filterable list of documents in this workspace or project. Use it to find and open files.',
  dashboardWidget: {
    icon: TbFileSearch,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: createDashboardWidgetAdapter(
      DocumentBrowserEmbed,
      (config: DocumentBrowserEmbedConfig) => ({ config: encodeDocumentBrowserEmbedConfig(config) })
    ),
    isValidConfig: isDocumentBrowserEmbedConfig,
    createDefaultConfig: () => ({
      q: '',
      conditions: [],
      sort: 'updated_at',
      sortDir: 'desc',
      visibleBaseColumnIds: [...DOCUMENT_BROWSER_BASE_COLUMN_IDS],
      visibleFieldIds: []
    }),
    getTitle: () => 'Document browser',
    configForm: DocumentBrowserEmbedConfigForm,
    dialogWidth: 'min(1200px, 92vw)'
  },
  mdxComponent: {
    component: DocumentBrowserEmbed,
    mode: 'block',
    allowedProps: ['config'],
    editorSpec: {
      editableComponent: DocumentBrowserEmbedEditable,
      nodeOptions: { isVoid: true },
      mdxRule: documentBrowserEmbedMdxRule,
      slashCommand: {
        icon: <TbFileSearch size={14} />,
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
