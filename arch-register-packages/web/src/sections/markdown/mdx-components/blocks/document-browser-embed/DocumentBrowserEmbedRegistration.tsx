import { TbFileSearch } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import {
  DOCUMENT_BROWSER_EMBED_TYPE,
  DocumentBrowserEmbedEditable,
  documentBrowserEmbedMdxRule
} from './DocumentBrowserEmbedEditable';
import type { DocumentBrowserEmbedSlateElement } from './types';

export const documentBrowserEmbedSpec = defineMdxComponent<
  DocumentBrowserEmbedSlateElement,
  { config?: string },
  'block'
>({
  component: DocumentBrowserEmbed,
  mode: 'block',
  allowedProps: ['config'],
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
