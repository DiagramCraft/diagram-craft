import { TbChecklist } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { AssessmentSchemaConfigForm } from './AssessmentSchemaConfigForm';
import {
  AssessmentStatusStatWidget,
  type AssessmentStatusStatConfig
} from './AssessmentStatusStatWidget';
import { isAssessmentStatus } from './assessmentSummaryLogic';
import styles from '../WidgetConfigDialog.module.css';

export const ASSESSMENT_STATUS_STAT_TYPE = 'AssessmentStatusStat' as const;

const ConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentStatusStatConfig;
  onChange: (config: AssessmentStatusStatConfig) => void;
}) => (
  <>
    <AssessmentSchemaConfigForm config={config} onChange={onChange} statusRequired />
    <DialogSection label="Subtext" required={false}>
      <div className={styles.options}>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Template</span>
          <div className={styles.optionControl}>
            <input
              type="text"
              className={styles.labelInput}
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
export const assessmentStatusStatSpec: DashboardWidgetSpec<AssessmentStatusStatConfig> = {
  icon: TbChecklist,
  label: 'Assessment status',
  description:
    'Number of assessments on an entity type that are overdue, in progress, not started or complete.',
  defaultW: 3,
  defaultH: 5,
  surfaces: ['workspace'],
  component: AssessmentStatusStatWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is AssessmentStatusStatConfig =>
    typeof config.schemaName === 'string' &&
    config.schemaName.length > 0 &&
    isAssessmentStatus(config.status) &&
    (config.label === undefined || typeof config.label === 'string') &&
    (config.subtextTemplate === undefined || typeof config.subtextTemplate === 'string'),
  createDefaultConfig: () => ({ schemaName: '', status: 'overdue' }),
  getTitle: config => config.label?.trim() || 'Assessment status',
  configForm: ConfigForm
};
