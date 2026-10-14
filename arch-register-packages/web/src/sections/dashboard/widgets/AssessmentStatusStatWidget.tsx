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
import { useWidgetBodyTitle } from './WidgetBodyTitle';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import registrationStyles from '../WidgetConfigDialog.module.css';

export type AssessmentStatusStatConfig = {
  /** Name of the entity schema the assessments must target (`assessment.scope`). */
  schemaName: string;
  status: EntityAssessmentStatus;
  /** May contain `{count}`, `{total}` and `{notStarted}`. */
  subtextTemplate?: string;
};

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

export const ASSESSMENT_STATUS_STAT_TYPE = 'AssessmentStatusStat' as const;

export const ConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentStatusStatConfig;
  onChange: (config: AssessmentStatusStatConfig) => void;
}) => (
  <>
    <AssessmentSchemaConfigForm config={config} onChange={onChange} statusRequired />
    <DialogSection label="Subtext" required={false}>
      <div className={registrationStyles.options}>
        <label className={registrationStyles.optionRow}>
          <span className={registrationStyles.optionLabel}>Template</span>
          <div className={registrationStyles.optionControl}>
            <input
              type="text"
              className={registrationStyles.labelInput}
              value={config.subtextTemplate ?? ''}
              placeholder="e.g. of {total} assessments"
              onChange={event => {
                const value = event.currentTarget.value;
                onChange({ ...config, subtextTemplate: value.trim() === '' ? undefined : value });
              }}
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);

/**
 * Dashboard-only stat tile: the number of assessments targeting an entity type that are overdue,
 * in progress, not started or complete (the statuses are derived from the responses recorded
 * against the in-scope entities, which an entity-query `AggregateStat` cannot express).
 */
