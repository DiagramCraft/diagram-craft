import type { CSSProperties } from 'react';
import { TbClipboardCheck } from 'react-icons/tb';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { formatDate } from '../../../utils/dateFormat';
import { queueItemPriority } from '../dataStewardshipQueue';
import { sortByDueDate } from '../dataStewardshipDashboardLogic';
import {
  CaseConfigForm,
  DS_CASE_DEFAULTS,
  isCaseConfig,
  NotConfigured,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  useCaseQueue,
  useOpenCase,
  type CaseConfig
} from '../dataStewardshipWidgetSupport';
import styles from '../sections/DataStewardshipQueueWidget.module.css';

export const CaseQueueWidget = ({ config }: { config: CaseConfig }) => {
  const queue = useCaseQueue(config);
  const openCase = useOpenCase();
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  if (queue.isLoading) return <LoadingState text="Loading queue…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  if (queue.items.length === 0) return <EmptyState title="Nothing matches this filter." compact />;

  return (
    <div className={styles.queue}>
      {sortByDueDate(queue.items).map(item => {
        const priority = queueItemPriority(item.case);
        return (
          <button
            key={item.case.id}
            type="button"
            className={styles.card}
            style={{ '--tone': PRIORITY_TONE[priority] } as CSSProperties}
            onClick={() => openCase(item)}
          >
            <span className={styles.cardTick} />
            <span className={styles.cardBody}>
              <span className={styles.cardHd}>
                <span className={styles.cardKind}>
                  {caseKindLabel(item.case.caseKind, item.case.payload)}
                </span>
                <span className={styles.pill} style={{ color: PRIORITY_TONE[priority] }}>
                  {PRIORITY_LABEL[priority]}
                </span>
                <span className={`${styles.cardKind} mono`}>{item.case.id.slice(0, 8)}</span>
              </span>
              <span className={styles.cardTitle}>{item.dataset._name}</span>
              <span className={styles.cardMeta}>
                <span>{item.dataset._publicId}</span>
              </span>
            </span>
            <span className={styles.cardDue} style={{ color: dueTone(item.case.dueAt) }}>
              {dueLabel(item.case.dueAt)}
              <span className={styles.cardDueDate}>
                {item.case.dueAt ? formatDate(item.case.dueAt, '', dateTimeFormatPreference) : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const CaseQueueHeaderActions = ({ config }: { config: CaseConfig }) => {
  const queue = useCaseQueue(config);
  return <span className="dim mono">{queue.isLoading ? '' : queue.items.length}</span>;
};

export const caseQueueSpec = defineComponent({
  type: 'data-stewardship-case-queue',
  category: 'data-views',
  name: 'Case queue',
  description: 'Open governance cases, oldest deadline first, with derived priority.',
  dashboardWidget: {
    icon: TbClipboardCheck,
    defaultW: 12,
    defaultH: 22,
    surfaces: ['workspace'],
    component: CaseQueueWidget,
    headerActionsComponent: CaseQueueHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isCaseConfig,
    createDefaultConfig: () => ({ ...DS_CASE_DEFAULTS, scope: 'mine' }),
    configForm: CaseConfigForm
  }
});
