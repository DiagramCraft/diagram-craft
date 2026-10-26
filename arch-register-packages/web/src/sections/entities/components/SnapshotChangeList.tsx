import type { ChangeRow } from './entityTimelineHelpers';
import styles from './SnapshotChangeList.module.css';

/**
 * Lists the field changes of a planned or historical snapshot as `field  from → to` rows.
 * `card` renders compact wrapped rows (timeline detail panels); `grid` aligns the columns
 * (planned-changes list). When there are no changes, `emptyText` is shown instead, if given.
 */
export const SnapshotChangeList = ({
  changes,
  variant = 'card',
  emptyText
}: {
  changes: ChangeRow[];
  variant?: 'card' | 'grid';
  emptyText?: string;
}) => {
  if (changes.length === 0) {
    if (!emptyText) return null;
    return (
      <div className={variant === 'card' ? styles.cardRow : styles.gridEmpty}>{emptyText}</div>
    );
  }

  return (
    <>
      {changes.map(change => (
        <div key={change.label} className={variant === 'card' ? styles.cardRow : styles.gridRow}>
          <span className={styles.field}>{change.label}</span>
          <span className={styles.from}>{change.from}</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.to}>{change.to}</span>
        </div>
      ))}
    </>
  );
};
