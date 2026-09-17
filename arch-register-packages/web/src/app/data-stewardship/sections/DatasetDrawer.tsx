import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { useSchemas } from '../../../hooks/useSchemas';
import { usePrincipalLabel, type PrincipalValue } from '../../../hooks/usePrincipalLabel';
import { useChangeCasesByEntity } from '../../../hooks/useChangeCases';
import { entityDetailQuery } from '../../../queries/entities';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { useDatasetCoverageRollup } from '../useDatasetCoverageRollup';
import { DATASET_COVERAGE_GAP_LABEL } from '../datasetCoverage';
import { fieldLabel, datasetFieldValue } from '../datasetFieldDisplay';
import { useDataStewardshipAssessmentRows } from '../useDataStewardshipAssessmentRows';
import { DS_ASSESSMENT_STATUS_LABEL } from '../dataStewardshipAssessments';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { useDataStewardshipQueue } from '../dataStewardshipQueue';
import type { DataStewardshipConfig } from '../dataStewardshipQueries';
import styles from './DatasetDrawer.module.css';

const ATTRIBUTE_FIELDS = ['classification', 'retention_policy'] as const;

const STEWARDSHIP_TEXT_FIELDS = [
  'review_date',
  'review_status',
  'stewardship_status',
  'regulatory_tags',
  'processing_purposes',
  'permitted_residency_regions'
] as const;

/**
 * Slide-over showing one dataset's (Information Asset / Data Entity's) attributes, stewardship
 * metadata, coverage roll-up, open queue items (`useDataStewardshipQueue`, filtered to this
 * dataset — #3298), change cases, assessments (`useDataStewardshipAssessmentRows`, filtered to
 * this dataset — #3302), and placeholders for the sections later sub-issues of #3152 own
 * (exceptions #3301) or that need a dependency not yet configured (flows/systems, which need the
 * API & Integration Catalog app, #3150). Mirrors `../../risk-compliance/sections/RiskDrawer.tsx`.
 */
export const DatasetDrawer = ({
  workspaceSlug,
  datasetId,
  dataStewardshipConfig,
  onClose,
  onOpenCase
}: {
  workspaceSlug: string;
  datasetId: string;
  dataStewardshipConfig: DataStewardshipConfig;
  onClose: () => void;
  /** Opens the governance case drawer for a queue item — only `DataStewardshipMyWorkScreen.tsx`
   *  currently has one (`DataStewardshipCaseDrawer.tsx`, #3298); when omitted, queue items in the
   *  list below render without a click action instead of silently failing. */
  onOpenCase?: (caseId: string) => void;
}) => {
  const navigate = useNavigate();
  const dataset = useQuery(entityDetailQuery(workspaceSlug, datasetId));
  const uid = dataset.data?._uid ?? null;
  const schemas = useSchemas(workspaceSlug);
  const dataEntitySchema = schemas.data?.find(
    schema => schema.id === dataStewardshipConfig.dataEntitySchemaId
  );
  const principalLabel = usePrincipalLabel();

  const coverage = useDatasetCoverageRollup(workspaceSlug, uid);
  const cases = useChangeCasesByEntity(workspaceSlug, uid ?? '', !!uid);
  const assessments = useDataStewardshipAssessmentRows(
    workspaceSlug,
    dataStewardshipConfig.dataEntitySchemaId,
    !!uid
  );
  const assessmentRowsForDataset = assessments.rows.filter(row => row.entity._uid === uid);
  // Reuses the same workspace-wide "all open items" queue My work builds (#3298), narrowed to this
  // one dataset — rather than a bespoke per-dataset query, so the two surfaces can never disagree
  // about which cases are open/relevant.
  const queue = useDataStewardshipQueue(
    workspaceSlug,
    dataStewardshipConfig.dataEntitySchemaId,
    'all',
    !!uid
  );
  const queueItemsForDataset = queue.items.filter(item => item.dataset._uid === uid);

  if (dataset.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading dataset…</div>
      </Drawer>
    );
  }
  if (dataset.isError || !dataset.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This dataset is unavailable.</div>
      </Drawer>
    );
  }

  const entity = dataset.data;
  const classification = typeof entity.classification === 'string' ? entity.classification : null;
  const ownerLabel = entity._owner?.name ?? null;
  const stewardLabel = principalLabel(entity.steward as PrincipalValue);
  const custodianLabel = principalLabel(entity.custodian as PrincipalValue);

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={classification && <Chip tone="ghost">{classification}</Chip>}
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sectionLabel}>Attributes</div>
      {ATTRIBUTE_FIELDS.map(fieldId => (
        <div className={styles.attributeRow} key={fieldId}>
          <span className={styles.attributeLabel}>{fieldLabel(dataEntitySchema, fieldId)}</span>
          <span>{datasetFieldValue(dataEntitySchema, entity, fieldId)}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>Stewardship</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Owner</span>
        <span>{ownerLabel ?? '—'}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Steward</span>
        <span>{stewardLabel ?? '—'}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Custodian</span>
        <span>{custodianLabel ?? '—'}</span>
      </div>
      {STEWARDSHIP_TEXT_FIELDS.map(fieldId => (
        <div className={styles.attributeRow} key={fieldId}>
          <span className={styles.attributeLabel}>{fieldLabel(dataEntitySchema, fieldId)}</span>
          <span>{datasetFieldValue(dataEntitySchema, entity, fieldId)}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>
        Coverage
        <span className={styles.sectionCaption}>
          Named owner, named steward, confirmed classification, and a current review — distinct from
          Stewardship Status above, which only tracks steward/custodian/review date.
        </span>
      </div>
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

      <div className={styles.sectionLabel}>Queue items — {queueItemsForDataset.length}</div>
      {queue.isLoading ? (
        <span className="dim">Loading…</span>
      ) : queueItemsForDataset.length === 0 ? (
        <span className="dim">Nothing in the queue against this dataset.</span>
      ) : (
        queueItemsForDataset.map(item => {
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
          return onOpenCase ? (
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
              onClick={() => onOpenCase(item.case.id)}
            >
              {content}
            </button>
          ) : (
            <div key={item.case.id} className={styles.attributeRow}>
              {content}
            </div>
          );
        })
      )}

      <div className={styles.sectionLabel}>Cases</div>
      {cases.isLoading ? (
        <span className="dim">Loading…</span>
      ) : (cases.data ?? []).length > 0 ? (
        <div className={styles.tags}>
          {(cases.data ?? []).map(changeCase => (
            <Chip key={changeCase.id} tone="ghost">
              {changeCase.name ?? changeCase.id}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No change cases linked.</span>
      )}

      <div className={styles.sectionLabel}>Exceptions</div>
      <span className="dim">Not yet available — exceptions/waivers ship with #3301.</span>

      <div className={styles.sectionLabel}>Assessments</div>
      {assessments.isLoading ? (
        <span className="dim">Loading…</span>
      ) : assessmentRowsForDataset.length === 0 ? (
        <span className="dim">No assessments target this dataset.</span>
      ) : (
        <div className={styles.tags}>
          {assessmentRowsForDataset.map(row => (
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
      )}

      <div className={styles.sectionLabel}>Flows</div>
      <span className="dim">
        Requires the API &amp; Integration Catalog app (#3150), not yet configured.
      </span>

      <div className={styles.sectionLabel}>Systems</div>
      <span className="dim">
        Requires the API &amp; Integration Catalog app (#3150), not yet configured.
      </span>
    </Drawer>
  );
};
