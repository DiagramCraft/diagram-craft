import { useMemo } from 'react';
import {
  ASSESSMENT_STATUS_LABEL,
  ASSESSMENT_STATUS_TONE,
  TINTED_ASSESSMENT_STATUSES,
  countByStatus,
  renderAssessmentSubtext,
  ASSESSMENT_STATUSES
} from './assessmentSummaryLogic';
import { useSchemaAssessmentSummaries } from './useSchemaAssessmentSummaries';
import styles from './AssessmentStatusStatWidget.module.css';
import { useWidgetBodyTitle } from './WidgetBodyTitle';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import registrationStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { withInitial } from '../../markdown/mdx-components/configSchema';

export const assessmentStatusStatConfigSchema = z.object({
  /** Name of the entity schema the assessments must target (`assessment.scope`). */
  schemaName: withInitial(z.string().min(1), ''),
  status: withInitial(z.enum(ASSESSMENT_STATUSES), 'overdue'),
  /** May contain `{count}`, `{total}` and `{notStarted}`. */
  subtextTemplate: z.string().optional()
});

export type AssessmentStatusStatConfig = z.infer<typeof assessmentStatusStatConfigSchema>;

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
