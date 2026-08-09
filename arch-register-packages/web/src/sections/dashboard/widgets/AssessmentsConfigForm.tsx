import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { AssessmentWidgetMode, AssessmentsWidgetConfig } from './AssessmentsWidget';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: AssessmentsWidgetConfig;
  onChange: (config: AssessmentsWidgetConfig) => void;
};

export const AssessmentsConfigForm = ({ config, onChange }: Props) => {
  const { assessmentTypes } = useWorkspaceContext();

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
      <DialogSection label="Assessment type" required={false}>
        <Select.Root
          value={config.assessmentTypeId ?? ''}
          onChange={value => onChange({ ...config, assessmentTypeId: optionalText(value ?? '') })}
        >
          <Select.Item value="">Any assessment type</Select.Item>
          {assessmentTypes.map(type => (
            <Select.Item key={type.id} value={type.id}>
              {type.name}
            </Select.Item>
          ))}
        </Select.Root>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Label</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.label ?? ''}
                onChange={e => onChange({ ...config, label: optionalText(e.target.value) })}
                placeholder="e.g. Risk and compliance reviews"
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
