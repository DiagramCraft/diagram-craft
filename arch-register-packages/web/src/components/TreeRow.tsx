import { type ReactNode } from 'react';
import styles from './TreeRow.module.css';
import { TbChevronRight } from 'react-icons/tb';

type TreeRowProps = {
  depth?: number;
  icon?: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  tagColor?: string;
};

export const TreeRow = ({
  depth = 0,
  icon,
  label,
  active,
  onClick,
  trailing,
  expandable,
  expanded,
  onExpand,
  tagColor,
}: TreeRowProps) => (
  <div
    className={`${styles.row} ${active ? styles.active : ''}`}
    style={{ paddingLeft: 8 + depth * 12 }}
    onClick={onClick}
  >
    {expandable ? (
      <button
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
    {tagColor && <span className={styles.tag} style={{ background: tagColor }} />}
    {trailing && <span className={styles.trailing}>{trailing}</span>}
  </div>
);
