import type { ReactNode, CSSProperties } from 'react';
import { TbCheck } from 'react-icons/tb';
import styles from './HoverCardParts.module.css';

/**
 * Shared presentational building blocks for HoverCard bodies (entity, document,
 * diagram, and any hover/pin tooltip that needs the same leaf-level markup).
 */

export const HoverCardTitle = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h4 className={styles.title} style={style}>
    {children}
  </h4>
);

export const HoverCardDescription = ({ children }: { children: ReactNode }) => (
  <p className={styles.description}>{children}</p>
);

export const TooltipRow = ({
  label,
  value,
  valueStyle
}: {
  label: ReactNode;
  value: ReactNode;
  valueStyle?: CSSProperties;
}) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{label}</span>
    <span className={styles.rowValue} style={valueStyle}>
      {value}
    </span>
  </div>
);

export const HoverCardRows = ({ children }: { children: ReactNode }) => (
  <div className={styles.rows}>{children}</div>
);

export const HoverCardDot = ({ color }: { color: string }) => (
  <span className={styles.dot} style={{ background: color }} />
);

export const TooltipChips = ({ children }: { children: ReactNode }) => (
  <div className={styles.chips}>{children}</div>
);

export const TooltipChip = ({
  children,
  style
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <span className={styles.chip} style={style}>
    {children}
  </span>
);

export const HoverCardTags = ({ tags }: { tags: string[] }) => (
  <div className={styles.tags}>
    {tags.map(tag => (
      <span key={tag} className={styles.tag}>
        {tag}
      </span>
    ))}
  </div>
);

export const HoverCardCommentFooter = ({
  commentCount,
  unresolvedCommentCount
}: {
  commentCount: number;
  unresolvedCommentCount: number;
}) => {
  if (commentCount <= 0) return null;

  return (
    <div className={styles.commentFooter}>
      {unresolvedCommentCount > 0 ? (
        <>
          <span className={styles.commentDot} />
          <span className={styles.commentUnresolved}>{unresolvedCommentCount} unresolved</span>
          <span className={styles.commentTotal}>· {commentCount} total</span>
        </>
      ) : (
        <>
          <TbCheck size={10} className={styles.commentCheck} />
          <span className={styles.commentTotal}>
            {commentCount} comment{commentCount !== 1 ? 's' : ''} · all resolved
          </span>
        </>
      )}
    </div>
  );
};
