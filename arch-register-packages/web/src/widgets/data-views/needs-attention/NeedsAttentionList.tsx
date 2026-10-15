import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { formatDate } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import {
  deriveDueDatePriority,
  type NeedsAttentionPriority,
  type NeedsAttentionQueueItem,
  type NeedsAttentionSeverity
} from './needsAttentionQueue';
import styles from './NeedsAttentionList.module.css';

const PRIORITY_LABEL: Record<NeedsAttentionPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const PRIORITY_TONE: Record<NeedsAttentionPriority, string> = {
  high: 'var(--cmp-fg-danger, #ef4444)',
  medium: 'var(--cmp-fg-warning, #eab308)',
  low: 'var(--cmp-fg-dim, #9ca3af)'
};

type Props = {
  items: NeedsAttentionQueueItem[];
  isLoading: boolean;
  isError: boolean;
  severity: NeedsAttentionSeverity;
  limit: number;
  onOpenEntity: (publicId: string) => void;
  emptyTitle?: string;
};

/**
 * The shared "needs attention" queue row list, factored out of API & Integration Catalog's and
 * Data Stewardship's independently-built panels (#3466). Renders each item's entity name, case-kind
 * label, and due date, plus a derived priority pill when `severity === 'due-date'`.
 */
export const NeedsAttentionList = ({
  items,
  isLoading,
  isError,
  severity,
  limit,
  onOpenEntity,
  emptyTitle = 'Nothing awaiting a decision'
}: Props) => {
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  if (isLoading) {
    return (
      <div className={styles.row}>
        <LoadingState text="Loading queue…" size="sm" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className={styles.row}>
        <Banner variant="error">Could not load the queue.</Banner>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className={styles.row}>
        <EmptyState title={emptyTitle} compact />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {items.slice(0, limit).map(item => {
        const priority = severity === 'due-date' ? deriveDueDatePriority(item.case) : null;
        return (
          <button
            key={item.case.id}
            type="button"
            className={styles.row}
            onClick={() => onOpenEntity(item.entity._publicId)}
          >
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{item.entity._name}</span>
              <span className={`${styles.rowSub} dim`}>
                {caseKindLabel(item.case.caseKind, item.case.payload)}
                {priority && (
                  <span className={styles.priorityPill} style={{ color: PRIORITY_TONE[priority] }}>
                    {PRIORITY_LABEL[priority]}
                  </span>
                )}
              </span>
            </span>
            {item.case.dueAt && (
              <span className="dim mono" style={{ fontSize: 10.5 }}>
                due {formatDate(item.case.dueAt, '—', dateTimeFormatPreference)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
