import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbFileSearch } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import { DocumentBrowserEmbedDialog } from './DocumentBrowserEmbedDialog';
import type { DocumentBrowserEmbedSlateElement } from './types';

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
      placeholder={
        <>
          <TbFileSearch size={16} />
          <span>Configure a document browser…</span>
        </>
      }
      content={<DocumentBrowserEmbed config={config === '' ? undefined : config} />}
      dialog={(open, onClose) => (
        <DocumentBrowserEmbedDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
