import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { useEntities } from '../../../hooks/useEntities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { formatDate } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import { DS_MY_WORK_ID, DS_RAIL_PATHS } from '../dataStewardshipSections';
import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import {
  isCaseOverdue,
  queueItemPriority,
  useDataStewardshipQueue,
  type DataStewardshipQueueItem,
  type DataStewardshipQueuePriority,
  type DataStewardshipQueueScope
} from '../dataStewardshipQueue';
import { DataStewardshipCaseDrawer } from './DataStewardshipCaseDrawer';
import { DataStewardshipReviewCalendar } from './DataStewardshipReviewCalendar';
import type { DataStewardshipMyWorkSearchParams } from '../../../routes/searchParams';
import styles from './DataStewardshipStewardshipScreen.module.css';
import queueStyles from './DataStewardshipMyWorkScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

const PRIORITY_LABEL: Record<DataStewardshipQueuePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const PRIORITY_TONE: Record<DataStewardshipQueuePriority, string> = {
  high: DANGER,
  medium: WARN,
  low: 'var(--cmp-fg-dim, #9ca3af)'
};

const SCOPE_LABEL: Record<DataStewardshipQueueScope, string> = {
  mine: 'Assigned to me',
  all: 'All open items',
  late: 'Past due'
};

const DECISION_CASE_KINDS = new Set(['entity.change-case', 'entity.deprecation']);

/**
 * The Data Stewardship review queue and app landing screen (#3298) — a stat strip, a six-week
 * due-date calendar, and the queue list itself. Backed by the existing governance inbox /
 * case-reminder machinery (#3067) via `useDataStewardshipQueue`, not a new queue model — see that
 * module's doc comment for exactly which case kinds are surfaced and why (the Claude Design
 * reference's `DSMyWork`/`DSQueueCard`, `ds.jsx`, mocks a couple of kinds — "Access request",
 * "Data-subject request" — with no backing governance-case model anywhere in this codebase; those
 * are dropped rather than fabricated).
 *
 * The scope tabs the design reference puts in the screen body instead live in this section's own
 * primary sidebar (`MyWorkSidebarContent` in `DataStewardshipSidebar.tsx`) as a facet, alongside
 * Kind and Priority — this screen just reads the `scope` search param those facets drive, the same
 * split Stewardship/Classification already use for their own facets.
 *
 * There is no "assignee" facet/column: `governance.assignments.mine` only resolves an assignment
 * target for the current user's own tasks, so it can't be populated honestly for the "All open
 * items"/"Past due" scopes — the "Assigned to me" scope facet already conveys assignment implicitly.
 *
 * Every row opens the governance case drawer (`DataStewardshipCaseDrawer.tsx`) — not the shared
 * dataset drawer, even for `field-date-reminder` rows — since the point of a queue row is the case
 * that needs acting on, and that drawer surfaces the real Approve/Acknowledge/Request-changes
 * actions plus a link through to the dataset, rather than the other way around.
 */
export const DataStewardshipMyWorkScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const search = useSearch({ strict: false }) as DataStewardshipMyWorkSearchParams;
  const scope: DataStewardshipQueueScope = search.scope ?? 'mine';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const dataStewardshipConfig = resolveDataStewardshipConfig(configurations.data);
  const schemaId = dataStewardshipConfig?.dataEntitySchemaId ?? null;

  const mineQueue = useDataStewardshipQueue(
    workspaceSlug,
    schemaId,
    'mine',
    !!dataStewardshipConfig
  );
  const allQueue = useDataStewardshipQueue(workspaceSlug, schemaId, 'all', !!dataStewardshipConfig);
  const lateItems = allQueue.items.filter(item => isCaseOverdue(item.case));

  const datasets = useEntities(
    workspaceSlug,
    { schemaId: schemaId ?? undefined, view: 'full', limit: 500 },
    { enabled: !!dataStewardshipConfig }
  );
  const reviewsOverdue = datasets.data.filter(entity => entity.review_status === 'overdue');

  const scopedItems =
    scope === 'mine' ? mineQueue.items : scope === 'late' ? lateItems : allQueue.items;
  const filtered = scopedItems
    .filter(item => !search.kind || item.case.caseKind === search.kind)
    .filter(item => !search.priority || queueItemPriority(item.case) === search.priority)
    .sort((a, b) => (a.case.dueAt ?? '').localeCompare(b.case.dueAt ?? ''));

  const decisionsAwaited = allQueue.items.filter(item =>
    DECISION_CASE_KINDS.has(item.case.caseKind)
  );
  const mineDueSoon = mineQueue.items.filter(item => {
    if (!item.case.dueAt) return false;
    const days = (new Date(item.case.dueAt).getTime() - Date.now()) / 86400000;
    return days <= 7;
  });

  const isLoading = scope === 'mine' ? mineQueue.isLoading : allQueue.isLoading;

  const patchSearch = (patch: Partial<DataStewardshipMyWorkSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_MY_WORK_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openItem = (item: DataStewardshipQueueItem) => patchSearch({ caseId: item.case.id });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading data stewardship…</div>;
  }
  if (!dataStewardshipConfig) {
    return (
      <div className={styles.empty}>
        Data stewardship is not enabled. Configure the data stewardship capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="My work"
        chips={!isLoading && <span>{filtered.length}</span>}
        description={`${SCOPE_LABEL[scope]} — reviews, change-case approvals, and deprecation approvals, oldest deadline first.`}
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Assigned to me</div>
          <div className={styles.tileValue}>{mineQueue.items.length}</div>
          <div className={styles.tileSub}>{mineDueSoon.length} due within a week</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Past due</div>
          <div
            className={styles.tileValue}
            style={lateItems.length ? { color: DANGER } : undefined}
          >
            {lateItems.length}
          </div>
          <div className={styles.tileSub}>across all assignees</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Cases awaiting a decision</div>
          <div
            className={styles.tileValue}
            style={decisionsAwaited.length ? { color: WARN } : undefined}
          >
            {decisionsAwaited.length}
          </div>
          <div className={styles.tileSub}>change-case &amp; deprecation approvals</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Reviews overdue</div>
          <div
            className={styles.tileValue}
            style={reviewsOverdue.length ? { color: WARN } : undefined}
          >
            {reviewsOverdue.length}
          </div>
          <div className={styles.tileSub}>scheduled review date passed</div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Next six weeks</span>
          <span className="dim mono">queue items by due week</span>
        </div>
        <DataStewardshipReviewCalendar items={scopedItems} onOpenItem={openItem} />
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>{SCOPE_LABEL[scope]}</span>
          <span className="dim mono">{filtered.length}</span>
        </div>
        <div className={queueStyles.queue}>
          {isLoading ? (
            <div className="dim">Loading queue…</div>
          ) : filtered.length === 0 ? (
            <div className="dim">Nothing matches this filter.</div>
          ) : (
            filtered.map(item => {
              const priority = queueItemPriority(item.case);
              return (
                <button
                  key={item.case.id}
                  type="button"
                  className={queueStyles.card}
                  style={{ '--tone': PRIORITY_TONE[priority] } as React.CSSProperties}
                  onClick={() => openItem(item)}
                >
                  <span className={queueStyles.cardTick} />
                  <span className={queueStyles.cardBody}>
                    <span className={queueStyles.cardHd}>
                      <span className={queueStyles.cardKind}>
                        {caseKindLabel(item.case.caseKind, item.case.payload)}
                      </span>
                      <span className={queueStyles.pill} style={{ color: PRIORITY_TONE[priority] }}>
                        {PRIORITY_LABEL[priority]}
                      </span>
                      <span className={`${queueStyles.cardKind} mono`}>
                        {item.case.id.slice(0, 8)}
                      </span>
                    </span>
                    <span className={queueStyles.cardTitle}>{item.dataset._name}</span>
                    <span className={queueStyles.cardMeta}>
                      <span>{item.dataset._publicId}</span>
                    </span>
                  </span>
                  <span className={queueStyles.cardDue} style={{ color: dueTone(item.case.dueAt) }}>
                    {dueLabel(item.case.dueAt)}
                    <span className={queueStyles.cardDueDate}>
                      {item.case.dueAt ? formatDate(item.case.dueAt, '', dateTimeFormatPreference) : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {search.datasetId && dataStewardshipConfig && (
        <EntityDrawer
          workspaceSlug={workspaceSlug}
          entityId={search.datasetId}
          onClose={() => patchSearch({ datasetId: undefined })}
          onOpenGovernanceCase={caseId => patchSearch({ datasetId: undefined, caseId })}
        />
      )}
      {search.caseId && (
        <DataStewardshipCaseDrawer
          workspaceSlug={workspaceSlug}
          caseId={search.caseId}
          onClose={() => patchSearch({ caseId: undefined })}
          onOpenDataset={datasetId => patchSearch({ caseId: undefined, datasetId })}
        />
      )}
    </div>
  );
};
