import { PlateElement, type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../shared/mdx/leafMdxRule';
import { WikiLink } from './WikiLink';
import { WikiLinkDialog } from './WikiLinkDialog';
import { BaseInlineEditable } from '../../shared/mdx/BaseInlineEditable';
import type { WikiLinkSlateElement } from './types';

export const WIKI_LINK_TYPE = 'WikiLink' as const;

// ── MDX serialization rule ────────────────────────────────────────────────────

export const wikiLinkMdxRule = defineLeafMdxRule<WikiLinkSlateElement, 'inline'>({
  name: WIKI_LINK_TYPE,
  mode: 'inline',
  fields: [{ key: 'nodeId', attr: 'id', required: true }]
});

// ── Plate element ─────────────────────────────────────────────────────────────

export const WikiLinkEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<WikiLinkSlateElement>) => {
  const nodeId = element.nodeId ?? '';
  const isNew = !nodeId;

  return (
    <PlateElement element={element} as="span" {...props}>
      <BaseInlineEditable
        hasValue={!!nodeId}
        type={element.type}
        placeholder={<span>page link…</span>}
        dialog={(open, onClose) => (
          <WikiLinkDialog element={element} open={open} onClose={onClose} isNew={isNew} />
        )}
      >
        <WikiLink id={nodeId} />
      </BaseInlineEditable>
      {children}
    </PlateElement>
  );
};
