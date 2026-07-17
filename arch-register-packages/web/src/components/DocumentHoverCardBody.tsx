import type { CSSProperties, ReactNode } from 'react';
import {
  HoverCardCommentFooter,
  HoverCardDescription,
  HoverCardTitle,
  TooltipChip,
  TooltipChips
} from './HoverCardParts';

/**
 * Presentational document hover-card content. No fetching - pass already-resolved
 * fields. All data fields are optional since callers have varying amounts of
 * document data preloaded (a bare file record vs. a related-content/backlink row).
 */
export const DocumentHoverCardBody = ({
  name,
  path,
  documentTypeName,
  documentTypeColor,
  commentCount,
  unresolvedCommentCount,
  titleStyle,
  extra
}: {
  name: string;
  path?: string | null;
  documentTypeName?: string | null;
  documentTypeColor?: string | null;
  commentCount?: number | null;
  unresolvedCommentCount?: number | null;
  titleStyle?: CSSProperties;
  extra?: ReactNode;
}) => (
  <>
    <HoverCardTitle style={titleStyle}>{name}</HoverCardTitle>

    {documentTypeName ? (
      <TooltipChips>
        <TooltipChip style={documentTypeColor ? { color: documentTypeColor } : undefined}>
          {documentTypeName}
        </TooltipChip>
      </TooltipChips>
    ) : null}

    {path ? <HoverCardDescription>{path}</HoverCardDescription> : null}

    <HoverCardCommentFooter
      commentCount={commentCount ?? 0}
      unresolvedCommentCount={unresolvedCommentCount ?? 0}
    />

    {extra}
  </>
);
