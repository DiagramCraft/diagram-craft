import { DocumentBrowserEmbed } from '../../markdown/mdx-components/blocks/document-browser-embed/DocumentBrowserEmbed';
import { encodeDocumentBrowserEmbedConfig } from '../../markdown/mdx-components/blocks/document-browser-embed/DocumentBrowserEmbedCodec';
import type { DocumentBrowserEmbedConfig } from '../../markdown/mdx-components/blocks/document-browser-embed/types';

type Props = {
  config: DocumentBrowserEmbedConfig;
};

export const DocumentBrowserEmbedWidget = ({ config }: Props) => (
  <DocumentBrowserEmbed config={encodeDocumentBrowserEmbedConfig(config)} />
);
