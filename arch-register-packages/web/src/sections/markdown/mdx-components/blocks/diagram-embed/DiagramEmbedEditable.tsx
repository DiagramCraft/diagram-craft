import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxComponentPreview } from '../../MdxComponentPreview';
import { DiagramEmbedDialog } from './DiagramEmbedDialog';
import type { DiagramEmbedSlateElement } from './types';

export const DIAGRAM_EMBED_TYPE = 'DiagramEmbed' as const;

export const diagramEmbedMdxRule = defineLeafMdxRule<DiagramEmbedSlateElement, 'block'>({
  name: DIAGRAM_EMBED_TYPE,
  mode: 'block',
  fields: [{ key: 'fileId', attr: 'id', required: true }, { key: 'caption' }]
});

export const DiagramEmbedEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<DiagramEmbedSlateElement>) => {
  const fileId = element.fileId ?? '';
  const caption = element.caption ?? '';
  const isNew = !fileId;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={!!fileId}
      placeholder={<span>Choose diagram…</span>}
      content={<MdxComponentPreview type={DIAGRAM_EMBED_TYPE} props={{ id: fileId, caption }} />}
      dialog={(open, onClose) => (
        <DiagramEmbedDialog element={element} open={open} onClose={onClose} isNew={isNew} />
      )}
      fullWidth
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
