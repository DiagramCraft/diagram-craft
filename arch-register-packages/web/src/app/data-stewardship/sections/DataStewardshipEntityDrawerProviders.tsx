import { Chip } from '../../../components/Chip';
import type { ReactNode } from 'react';
import { useChangeCasesByEntity } from '../../../hooks/useChangeCases';
import { computeDatasetCoverage, DATASET_COVERAGE_GAP_LABEL } from '../datasetCoverage';
import { useDataStewardshipAssessmentRows } from '../useDataStewardshipAssessmentRows';
import { DS_ASSESSMENT_STATUS_LABEL } from '../dataStewardshipAssessments';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { useDataStewardshipQueue } from '../dataStewardshipQueue';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import styles from './DatasetDrawer.module.css';

const DATA_STEWARDSHIP_FIELD_IDS = [
  'classification',
  'steward',
  'custodian',
  'review_date',
  'review_status',
  'stewardship_status'
] as const;

const supportsDataStewardshipSchema = (context: EntityDrawerProviderContext): boolean =>
  DATA_STEWARDSHIP_FIELD_IDS.every(fieldId =>
    context.schema.fields.some(field => field.id === fieldId)
  );

const ProviderFrame = ({
  label,
  showLabel = true,
  children
}: {
  label: string;
  showLabel?: boolean;
  children?: ReactNode;
}) => (
  <div>
    {showLabel && <div className={styles.sectionLabel}>{label}</div>}
    {children}
  </div>
);

const CoverageProvider = ({ label, showLabel, context }: EntityDrawerProviderProps) => {
  const coverage = computeDatasetCoverage({
    owner: context.entity._owner,
    steward: context.entity.steward,
    classification: context.entity.classification,
    reviewStatus: context.entity.review_status
  });

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <span className={styles.sectionCaption}>
        Named owner, named steward, confirmed classification, and a current review — distinct from
        Stewardship Status above, which only tracks steward/custodian/review date.
      </span>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>dsCovered</div>
          <div className={styles.statValue}>{coverage.dsCovered ? 'Yes' : 'No'}</div>
        </div>
      </div>
      {coverage.dsGaps.length > 0 && (
        <div className={styles.tags}>
          {coverage.dsGaps.map(gap => (
            <Chip key={gap} tone="ghost">
              {DATASET_COVERAGE_GAP_LABEL[gap]}
            </Chip>
          ))}
        </div>
      )}
    </ProviderFrame>
  );
};

const QueueItemsProvider = ({ label, showLabel, context }: EntityDrawerProviderProps) => {
  const queue = useDataStewardshipQueue(context.workspaceId, context.schema.id, 'all');
  const items = queue.items.filter(item => item.dataset._uid === context.entity._uid);
  const state = queue.isLoading ? 'loading' : items.length > 0 ? 'ready' : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="Nothing in the queue against this dataset."
      >
        {items.map(item => {
          const content = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>
                  {caseKindLabel(item.case.caseKind, item.case.payload)}
                </span>
              </div>
              <div className="dim" style={{ fontSize: 10.5, marginTop: 3 }}>
                <span className="mono">due {dueLabel(item.case.dueAt)}</span>
              </div>
            </>
          );

          return context.openGovernanceCase ? (
            <button
              key={item.case.id}
              type="button"
              className={styles.attributeRow}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 0,
                cursor: 'pointer'
              }}
              onClick={() => context.openGovernanceCase?.(item.case.id)}
            >
              {content}
            </button>
          ) : (
            <div key={item.case.id} className={styles.attributeRow}>
              {content}
            </div>
          );
        })}
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const ChangeCasesProvider = ({ label, showLabel, context }: EntityDrawerProviderProps) => {
  const cases = useChangeCasesByEntity(context.workspaceId, context.entity._uid, true);
  const items = cases.data ?? [];
  const state = cases.isLoading
    ? 'loading'
    : cases.isError
      ? 'unavailable'
      : items.length > 0
        ? 'ready'
        : 'empty';

  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No change cases linked."
        unavailableMessage="Change cases are unavailable."
      >
        <div className={styles.tags}>
          {items.map(changeCase => (
            <Chip key={changeCase.id} tone="ghost">
              {changeCase.name ?? changeCase.id}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

const AssessmentsProvider = ({ label, showLabel, context }: EntityDrawerProviderProps) => {
  const assessments = useDataStewardshipAssessmentRows(context.workspaceId, context.schema.id);
  const rows = assessments.rows.filter(row => row.entity._uid === context.entity._uid);
  const state = assessments.isLoading ? 'loading' : rows.length > 0 ? 'ready' : 'empty';
  return (
    <ProviderFrame label={label} showLabel={showLabel}>
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No assessments target this dataset."
      >
        <div className={styles.tags}>
          {rows.map(row => (
            <Chip
              key={row.assessment.id}
              tone="ghost"
              title={`${row.kind} · due ${dueLabel(row.due)}`}
              color={row.status === 'overdue' ? 'var(--cmp-fg-danger, #ef4444)' : undefined}
            >
              {row.kind} — {DS_ASSESSMENT_STATUS_LABEL[row.status]}
              <span className="dim" style={{ marginLeft: 4, color: dueTone(row.due) }}>
                {dueLabel(row.due)}
              </span>
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </ProviderFrame>
  );
};

export const dataStewardshipEntityDrawerProviderDefinitions = [
  {
    slotId: 'data-stewardship.coverage',
    supports: supportsDataStewardshipSchema,
    Component: CoverageProvider
  },
  {
    slotId: 'data-stewardship.queue-items',
    supports: supportsDataStewardshipSchema,
    Component: QueueItemsProvider
  },
  {
    slotId: 'data-stewardship.change-cases',
    supports: supportsDataStewardshipSchema,
    Component: ChangeCasesProvider
  },
  {
    slotId: 'data-stewardship.assessments',
    supports: supportsDataStewardshipSchema,
    Component: AssessmentsProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
