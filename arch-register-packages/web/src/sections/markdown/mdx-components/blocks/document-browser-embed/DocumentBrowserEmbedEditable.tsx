import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
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
  width: 'min(1200px, 92vw)',
  fromElement: el =>
    decodeDocumentBrowserEmbedConfig(el.config) ?? createDefaultDocumentBrowserEmbedConfig(),
  toElement: config => ({ config: encodeDocumentBrowserEmbedConfig(config) })
};

export const DocumentBrowserEmbedEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<DocumentBrowserEmbedSlateElement>) => {
  const config = element.config ?? '';
  const hasValue = !!config;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={<span>Configure a document browser…</span>}
      content={<MdxComponentPreview type={DOCUMENT_BROWSER_EMBED_TYPE} props={{ config }} />}
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={documentBrowserEmbedMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
