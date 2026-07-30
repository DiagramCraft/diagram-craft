import { TbFileSearch } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { DocumentBrowserEmbedWidget } from '../../../../dashboard/widgets/DocumentBrowserEmbedWidget';
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

export const documentBrowserEmbedSpec = defineMdxComponent<
  DocumentBrowserEmbedSlateElement,
  { config?: string },
  'block'
>({
  component: DocumentBrowserEmbed,
  mode: 'block',
  allowedProps: ['config'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbFileSearch,
    label: 'Document browser',
    description: 'A filterable list of documents in this workspace or project.',
    defaultW: 6,
    defaultH: 4,
    surfaces: ['workspace', 'project'],
    component: DocumentBrowserEmbedWidget,
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
  editorSpec: {
    editableComponent: DocumentBrowserEmbedEditable,
    nodeOptions: { isVoid: true },
    mdxRule: documentBrowserEmbedMdxRule,
    slashCommand: {
      key: 'document-browser-embed',
      label: 'Document Browser',
      description: 'Embed a filterable list of documents from this location',
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
});
