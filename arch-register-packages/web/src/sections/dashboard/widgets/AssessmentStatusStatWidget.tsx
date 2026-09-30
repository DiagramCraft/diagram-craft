import { useMemo } from 'react';
import type { EntityAssessmentStatus } from '../../entities/entityDrawer/entityAssessments';
import {
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_STATUS_TONE,
  TINTED_ASSESSMENT_STATUSES,
  countByStatus,
  renderAssessmentSubtext
} from './assessmentSummaryLogic';
import { useSchemaAssessmentSummaries } from './useSchemaAssessmentSummaries';
import styles from './AssessmentStatusStatWidget.module.css';

export type AssessmentStatusStatConfig = {
  /** Name of the entity schema the assessments must target (`assessment.scope`). */
  schemaName: string;
  status: EntityAssessmentStatus;
  label?: string;
  /** May contain `{count}`, `{total}` and `{notStarted}`. */
  subtextTemplate?: string;
};

export const AssessmentStatusStatWidget = ({ config }: { config: AssessmentStatusStatConfig }) => {
  const { schemaFound, summaries, isLoading } = useSchemaAssessmentSummaries(config.schemaName);
  const counts = useMemo(() => countByStatus(summaries), [summaries]);

  if (isLoading) return <div className={`${styles.message} dim`}>Loading…</div>;
  if (!schemaFound) {
    return (
      <div className={`${styles.message} dim`}>Entity type “{config.schemaName}” not found.</div>
    );
  }

  const count = counts[config.status];
  const tinted = count > 0 && TINTED_ASSESSMENT_STATUSES.includes(config.status);
  return (
    <div className={styles.tile}>
      <div className={styles.label}>
        {config.label?.trim() || ASSESSMENT_STATUS_LABEL[config.status]}
      </div>
      <div
        className={styles.value}
        style={tinted ? { color: ASSESSMENT_STATUS_TONE[config.status] } : undefined}
      >
        {count}
      </div>
      {config.subtextTemplate && (
        <div className={styles.sub}>
          {renderAssessmentSubtext(config.subtextTemplate, counts, config.status)}
        </div>
      )}
    </div>
  );
};
