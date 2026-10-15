import { useMemo } from 'react';
import {
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_STATUS_TONE,
  TINTED_ASSESSMENT_STATUSES,
  countByStatus,
  renderAssessmentSubtext
} from '../../shared/data/assessmentSummaryLogic';
import { useSchemaAssessmentSummaries } from '../../shared/data/useSchemaAssessmentSummaries';
import styles from './AssessmentStatusStat.module.css';
import { useWidgetBodyTitle } from '../../shared/dashboard/WidgetBodyTitle';
import { AssessmentStatusStatConfig } from './types';

export const AssessmentStatusStatWidget = ({ config }: { config: AssessmentStatusStatConfig }) => {
  const title = useWidgetBodyTitle();
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
      <div className={styles.label}>{title ?? ASSESSMENT_STATUS_LABEL[config.status]}</div>
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
