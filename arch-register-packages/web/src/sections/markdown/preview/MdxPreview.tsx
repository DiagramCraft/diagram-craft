import { useMemo } from 'react';
import { parseMarkdownPreview } from './mdxMarkdown';
import {
  renderMarkdownPreview,
  type HighlightHandlers,
  type HighlightRange
} from './mdxRenderNode';

type MdxPreviewProps = {
  body: string;
  withoutFirstHeading?: boolean;
  highlightRanges?: HighlightRange[];
  highlightHandlers?: HighlightHandlers;
};

export const MdxPreview = ({
  body,
  withoutFirstHeading = false,
  highlightRanges,
  highlightHandlers
}: MdxPreviewProps) => {
  const parsed = useMemo(() => {
    if (!body.trim()) return [];
    return parseMarkdownPreview(body, withoutFirstHeading);
  }, [body, withoutFirstHeading]);

  if (!body.trim()) return null;

  return renderMarkdownPreview(parsed, highlightRanges, highlightHandlers);
};
