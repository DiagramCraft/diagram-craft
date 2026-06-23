import { useMemo } from 'react';
import { parseMarkdownPreview, renderMarkdownPreview } from './mdxMarkdown';

type MdxPreviewProps = {
  body: string;
  withoutFirstHeading?: boolean;
};

export const MdxPreview = ({ body, withoutFirstHeading = false }: MdxPreviewProps) => {
  const parsed = useMemo(() => {
    if (!body.trim()) return [];
    return parseMarkdownPreview(body, withoutFirstHeading);
  }, [body, withoutFirstHeading]);

  if (!body.trim()) return null;

  return renderMarkdownPreview(parsed);
};
