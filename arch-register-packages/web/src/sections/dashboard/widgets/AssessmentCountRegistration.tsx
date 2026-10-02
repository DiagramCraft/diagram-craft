import { TbClipboardCheck } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import type { AssessmentWidgetMode } from './assessmentsWidgetLogic';
import { AssessmentCountWidget, type AssessmentCountWidgetConfig } from './AssessmentCountWidget';
import styles from '../WidgetConfigDialog.module.css';

export const ASSESSMENT_COUNT_TYPE = 'AssessmentCount' as const;

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const AssessmentCountConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentCountWidgetConfig;
  onChange: (config: AssessmentCountWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  const selected = config.schemaNames ?? [];
  const toggleSchema = (name: string, checked: boolean) => {
    const next = checked ? [...selected, name] : selected.filter(existing => existing !== name);
    onChange({ ...config, schemaNames: next.length === 0 ? undefined : next });
  };

  return (
    <>
      <DialogSection label="Mode" required>
        <Select.Root
          value={config.mode}
          onChange={value =>
            onChange({ ...config, mode: (value ?? 'active') as AssessmentWidgetMode })
          }
        >
          <Select.Item value="active">Active</Select.Item>
          <Select.Item value="upcoming">Upcoming</Select.Item>
          <Select.Item value="overdue">Overdue</Select.Item>
          <Select.Item value="all">All</Select.Item>
        </Select.Root>
      </DialogSection>
      <DialogSection label="Scoped to entity types" required={false}>
        <div className={styles.options}>
          {schemas.map(schema => (
            <label key={schema.id} className={styles.optionRow}>
              <input
                type="checkbox"
                checked={selected.includes(schema.name)}
                onChange={event => toggleSchema(schema.name, event.currentTarget.checked)}
              />
              <span className={styles.optionLabel}>{schema.name}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Due within (days)</span>
            <div className={styles.optionControl}>
              <input
                type="number"
                min={0}
                className={styles.labelInput}
                value={config.dueWithinDays ?? ''}
                placeholder="Any"
                onChange={event => {
                  const value = event.currentTarget.value;
                  onChange({ ...config, dueWithinDays: value === '' ? undefined : Number(value) });
                }}
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Label</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.label ?? ''}
                onChange={event =>
                  onChange({ ...config, label: optionalText(event.currentTarget.value) })
                }
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Subtext</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.subtext ?? ''}
                onChange={event =>
                  onChange({ ...config, subtext: optionalText(event.currentTarget.value) })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};

const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

export const assessmentCountSpec: DashboardWidgetSpec<AssessmentCountWidgetConfig> = {
  icon: TbClipboardCheck,
  label: 'Assessment count',
  description: 'Number of assessments by mode, entity type scope and due window.',
  defaultW: 3,
  defaultH: 5,
  surfaces: ['workspace'],
  component: AssessmentCountWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is AssessmentCountWidgetConfig =>
    (config.mode === 'active' ||
      config.mode === 'upcoming' ||
      config.mode === 'overdue' ||
      config.mode === 'all') &&
    isOptionalString(config.assessmentTypeId) &&
    (config.schemaNames === undefined ||
      (Array.isArray(config.schemaNames) &&
        config.schemaNames.every(name => typeof name === 'string'))) &&
    (config.dueWithinDays === undefined || typeof config.dueWithinDays === 'number') &&
    isOptionalString(config.label) &&
    isOptionalString(config.subtext),
  createDefaultConfig: () => ({ mode: 'active' }),
  getTitle: config => config.label?.trim() || 'Assessment count',
  configForm: AssessmentCountConfigForm
};
