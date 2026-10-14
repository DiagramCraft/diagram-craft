import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import type { MdxRuleDef } from '../../defineComponent';
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

const readAttr = (attrs: Record<string, unknown>, key: string) => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

export const documentBrowserEmbedMdxRule: MdxRuleDef<DocumentBrowserEmbedSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, DOCUMENT_BROWSER_EMBED_TYPE),
      config: readAttr(attrs, 'config')
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      ...(slateNode.config ? { config: slateNode.config } : {})
    }),
    children: [],
    name: DOCUMENT_BROWSER_EMBED_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const documentBrowserEmbedMdxConfigSpec: MdxConfigSpec<
  DocumentBrowserEmbedSlateElement,
  DocumentBrowserEmbedConfig
> = {
  width: 'min(1200px, 92vw)',
  fromElement: el =>
    decodeDocumentBrowserEmbedConfig(el.config) ?? createDefaultDocumentBrowserEmbedConfig(),
  toElement: config => ({ config: encodeDocumentBrowserEmbedConfig(config) }),
  isValidConfig: () => true
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
