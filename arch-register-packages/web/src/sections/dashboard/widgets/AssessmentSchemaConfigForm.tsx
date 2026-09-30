import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_STATUS_LABEL,
  isAssessmentStatus
} from './assessmentSummaryLogic';
import type { EntityAssessmentStatus } from '../../entities/entityDrawer/entityAssessments';
import styles from '../WidgetConfigDialog.module.css';

type BaseConfig = { schemaName: string; label?: string };

type Props<C extends BaseConfig & { status?: EntityAssessmentStatus }> = {
  config: C;
  onChange: (config: C) => void;
  /** Whether `status` is required (stat) or an optional filter (table). */
  statusRequired: boolean;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

/** Shared config form for the assessment status stat and progress table widgets. */
export const AssessmentSchemaConfigForm = <
  C extends BaseConfig & { status?: EntityAssessmentStatus }
>({
  config,
  onChange,
  statusRequired
}: Props<C>) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={styles.labelInput}
          value={config.schemaName}
          onChange={event => onChange({ ...config, schemaName: event.currentTarget.value })}
        >
          <option value="">Select an entity type…</option>
          {schemas.map(schema => (
            <option key={schema.id} value={schema.name}>
              {schema.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Status" required={statusRequired}>
        <select
          className={styles.labelInput}
          value={config.status ?? ''}
          onChange={event => {
            const value = event.currentTarget.value;
            onChange({ ...config, status: isAssessmentStatus(value) ? value : undefined });
          }}
        >
          {!statusRequired && <option value="">All statuses</option>}
          {ASSESSMENT_STATUSES.map(status => (
            <option key={status} value={status}>
              {ASSESSMENT_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Title</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.label ?? ''}
                placeholder="Use the widget name"
                onChange={event =>
                  onChange({ ...config, label: optionalText(event.currentTarget.value) })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
