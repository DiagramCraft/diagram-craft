import { type ReactNode } from 'react';
import type { ContentMetadata } from '@arch-register/api-types/projectContract';
import { HoverCard } from './HoverCard';
import hoverCardStyles from './HoverCard.module.css';
import {
  HoverCardCommentFooter,
  HoverCardDescription,
  HoverCardTitle,
  TooltipRow
} from './HoverCardParts';
import styles from './DiagramMetadataPopover.module.css';

export const DiagramMetadataPopover = ({
  children,
  type,
  fallbackTitle,
  contentMetadata,
  commentCount,
  unresolvedCommentCount
}: {
  children: ReactNode;
  type: 'diagram' | 'folder' | 'markdown' | 'file';
  fallbackTitle: string;
  contentMetadata: ContentMetadata | null;
  commentCount?: number | null;
  unresolvedCommentCount?: number | null;
}) => {
  if (type !== 'diagram') return <>{children}</>;

  const title = contentMetadata?.title ?? fallbackTitle;

  return (
    <HoverCard
      anchorClassName={hoverCardStyles.blockAnchor}
      content={
        <>
          <HoverCardTitle>{title}</HoverCardTitle>

          {contentMetadata?.description ? (
            <HoverCardDescription>{contentMetadata.description}</HoverCardDescription>
          ) : null}

          {(contentMetadata?.category ?? contentMetadata?.company) && (
            <div className={styles.badgeRows}>
              {contentMetadata.category ? (
                <TooltipRow label="Category" value={contentMetadata.category} />
              ) : null}
              {contentMetadata.company ? (
                <TooltipRow label="Company" value={contentMetadata.company} />
              ) : null}
            </div>
          )}

          {contentMetadata?.keywords.length ? (
            <div className={styles.keywords}>
              {contentMetadata.keywords.map(keyword => (
                <span key={keyword} className={styles.keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}

          <HoverCardCommentFooter
            commentCount={commentCount ?? 0}
            unresolvedCommentCount={unresolvedCommentCount ?? 0}
          />
        </>
      }
    >
      {children}
    </HoverCard>
  );
};
