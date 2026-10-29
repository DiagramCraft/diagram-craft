import type { ReactNode } from 'react';
import styles from './SettingsBlock.module.css';

/** Vertical stack of {@link SettingsBlock}s with the standard settings page padding. */
export const SettingsBlockList = ({ children }: { children: ReactNode }) => (
  <div className={styles.list}>{children}</div>
);

/** Standard padded content area for list-style settings pages (tables, cards). */
export const SettingsPage = ({
  children,
  stacked = true
}: {
  children: ReactNode;
  /** Lay children out as a column with a standard gap. */
  stacked?: boolean;
}) => (
  <div className={stacked ? `${styles.page} ${styles.pageStacked}` : styles.page}>{children}</div>
);

/** Bordered settings panel with a title, optional description and a body. */
export const SettingsBlock = ({
  title,
  description,
  footer,
  actions,
  children
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Actions shown below the body, separated by a divider (e.g. the button that runs the block). */
  footer?: ReactNode;
  /** Buttons shown right-aligned in the title row, e.g. an "Add …" button. */
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className={styles.block}>
    <div className={styles.head}>
      <div className={styles.headText}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {actions && <div className={styles.headActions}>{actions}</div>}
    </div>
    <div className={styles.body}>{children}</div>
    {footer && <div className={styles.footer}>{footer}</div>}
  </div>
);

/**
 * Label + hint on the left, control on the right. Place directly inside a {@link SettingsBlock}
 * so the last row drops its divider.
 */
export const SettingsBlockField = ({
  label,
  hint,
  align = 'center',
  children
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Vertical alignment of label and control; use `top` for tall controls such as text areas. */
  align?: 'center' | 'top';
  children: ReactNode;
}) => (
  <div className={`${styles.field} ${align === 'top' ? styles.fieldTop : ''}`}>
    <div className={styles.fieldLeft}>
      <div className={styles.fieldLabel}>{label}</div>
      {hint && <div className={styles.fieldHint}>{hint}</div>}
    </div>
    <div className={styles.fieldRight}>{children}</div>
  </div>
);
