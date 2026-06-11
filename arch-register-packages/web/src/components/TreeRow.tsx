import { type ReactNode } from 'react';
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
  tagColor,
  className,
}: TreeRowProps) => (
  <div
    className={`${styles.row} ${active ? styles.active : ''} ${className ?? ''}`}
    style={{ paddingLeft: 8 + depth * 12 }}
    data-testid={testId}
    onClick={onClick}
    onContextMenu={onContextMenu}
  >
    {expandable ? (
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
            transition: 'transform 80ms',
          }}
        />
      </button>
    ) : (
      <span className={styles.chev} />
    )}
    <span className={styles.icon}>{icon}</span>
    <span className={styles.label}>{label}</span>
    {trailing && <span className={styles.trailing}>{trailing}</span>}
    {tagColor && <span className={styles.tag} style={{ background: tagColor }} />}
  </div>
);
