import type { ReactNode } from 'react';
import { TbChevronDown } from 'react-icons/tb';
import styles from './CollapsibleSection.module.css';

type CollapsibleSectionProps = {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Controls shown at the right edge of the header, next to the toggle. */
  actions?: ReactNode;
  children: ReactNode;
};

/** Bordered section with a foldable header, e.g. the configuration panel above a view. */
export const CollapsibleSection = ({
  title,
  open,
  onOpenChange,
  actions,
  children
}: CollapsibleSectionProps) => (
  <div className={styles.cCollapsibleSection}>
    <div className={styles.eHeader}>
      <button
        type="button"
        className={styles.eToggle}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <TbChevronDown size={12} className={styles.eIcon} data-open={open ? 'true' : 'false'} />
        <span className={styles.eTitle}>{title}</span>
      </button>
      {actions && <div className={styles.eActions}>{actions}</div>}
    </div>
    {open && <div className={styles.eBody}>{children}</div>}
  </div>
);
