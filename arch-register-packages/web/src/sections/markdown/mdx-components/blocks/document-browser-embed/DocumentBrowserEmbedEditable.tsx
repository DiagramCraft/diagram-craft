import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
import {
  createDefaultDocumentBrowserEmbedConfig,
  decodeDocumentBrowserEmbedConfig,
  encodeDocumentBrowserEmbedConfig
} from './DocumentBrowserEmbedCodec';
import type { DocumentBrowserEmbedConfig, DocumentBrowserEmbedSlateElement } from './types';

export const DOCUMENT_BROWSER_EMBED_TYPE = 'DocumentBrowserEmbed' as const;

export const documentBrowserEmbedMdxRule = defineLeafMdxRule<
  DocumentBrowserEmbedSlateElement,
  'block'
>({
  name: DOCUMENT_BROWSER_EMBED_TYPE,
  mode: 'block',
  fields: [{ key: 'config' }]
});

export const documentBrowserEmbedMdxConfigSpec: MdxConfigSpec<
  DocumentBrowserEmbedSlateElement,
  DocumentBrowserEmbedConfig
> = {
  fromElement: el =>
    decodeDocumentBrowserEmbedConfig(el.config) ?? createDefaultDocumentBrowserEmbedConfig(),
  toElement: config => ({ config: encodeDocumentBrowserEmbedConfig(config) })
};

export const DocumentBrowserEmbedEditable = (
  props: PlateElementProps<DocumentBrowserEmbedSlateElement>
) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={DOCUMENT_BROWSER_EMBED_TYPE}
    placeholder="Configure a document browser…"
    fullWidth
    configSpec={documentBrowserEmbedMdxConfigSpec}
    hasValue={el => !!el.config}
    previewProps={el => ({ config: el.config ?? '' })}
  />
);
