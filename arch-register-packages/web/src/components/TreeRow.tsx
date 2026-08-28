import { type CSSProperties, type ReactNode } from 'react';
import styles from './TreeRow.module.css';
import { TbChevronRight } from 'react-icons/tb';

type TreeRowProps = {
  depth?: number;
  icon?: ReactNode;
  label: ReactNode;
  testId?: string;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  trailing?: ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  /** Where the expand/collapse chevron renders. Defaults to 'start' (the usual tree layout). */
  chevronPosition?: 'start' | 'end';
  /** Skip reserving the icon column's width — for rows where no sibling row in the same list has an icon. */
  hideIconSlot?: boolean;
  /** Inline style override for the label text, e.g. a brighter color for a top-level grouping row. */
  labelStyle?: CSSProperties;
  tagColor?: string;
  className?: string;
};

export const TreeRow = ({
  depth = 0,
  icon,
  label,
  testId,
  active,
  onClick,
  onContextMenu,
  trailing,
  expandable,
  expanded,
  onExpand,
  chevronPosition = 'start',
  hideIconSlot = false,
  labelStyle,
  tagColor,
  className
}: TreeRowProps) => {
  const chevron = expandable && (
    <button
      type="button"
      className={styles.chev}
      onClick={e => {
        e.stopPropagation();
        onExpand?.();
      }}
    >
      <TbChevronRight
        size={10}
        style={{
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 80ms'
        }}
      />
    </button>
  );

  return (
    <div
      className={`${styles.row} ${active ? styles.active : ''} ${className ?? ''}`}
      style={{ paddingLeft: 8 + depth * 12 }}
      data-testid={testId}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {chevronPosition === 'start' ? chevron || <span className={styles.chev} /> : null}
      {hideIconSlot ? null : <span className={styles.icon}>{icon}</span>}
      <span className={styles.label} style={labelStyle}>
        {label}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      {tagColor && <span className={styles.tag} style={{ background: tagColor }} />}
      {chevronPosition === 'end' ? chevron : null}
    </div>
  );
};
