import { type ReactNode, useRef } from 'react';
import { Popover } from '@diagram-craft/app-components/Popover';
import type { ContentMetadata } from '@arch-register/api-types/projectContract';
import { TbCheck } from 'react-icons/tb';
import styles from './DiagramMetadataPopover.module.css';
import { useDelayedDisclosure } from '../hooks/useDelayedDisclosure';

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 120;

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
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const { open, setOpen, scheduleOpen, scheduleClose } = useDelayedDisclosure(
    OPEN_DELAY_MS,
    CLOSE_DELAY_MS
  );

  if (type !== 'diagram') return <>{children}</>;

  const totalComments = commentCount ?? 0;
  const unresolved = unresolvedCommentCount ?? 0;
  const title = contentMetadata?.title ?? fallbackTitle;

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
      >
        {children}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Content
          anchor={anchorRef}
          side="top"
          align="start"
          sideOffset={8}
          arrow={false}
          focus={false}
          closeButton={false}
          className={styles.panel}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
        >
          <div className={styles.body} onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
            <h4 className={styles.title}>{title}</h4>

            {contentMetadata?.description ? (
              <p className={styles.description}>{contentMetadata.description}</p>
            ) : null}

            {(contentMetadata?.category || contentMetadata?.company) && (
              <div className={styles.badgeRows}>
                {contentMetadata.category ? (
                  <div className={styles.badgeRow}>
                    <span className={styles.badgeLabel}>Category</span>
                    <span className={styles.badgeValue}>{contentMetadata.category}</span>
                  </div>
                ) : null}
                {contentMetadata.company ? (
                  <div className={styles.badgeRow}>
                    <span className={styles.badgeLabel}>Company</span>
                    <span className={styles.badgeValue}>{contentMetadata.company}</span>
                  </div>
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

            {totalComments > 0 && (
              <div className={styles.commentFooter}>
                {unresolved > 0 ? (
                  <>
                    <span className={styles.commentDot} />
                    <span className={styles.commentUnresolved}>{unresolved} unresolved</span>
                    <span className={styles.commentTotal}>· {totalComments} total</span>
                  </>
                ) : (
                  <>
                    <TbCheck size={10} className={styles.commentCheck} />
                    <span className={styles.commentTotal}>
                      {totalComments} comment{totalComments !== 1 ? 's' : ''} · all resolved
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
