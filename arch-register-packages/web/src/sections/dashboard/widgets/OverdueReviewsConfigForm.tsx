import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { OverdueReviewsWidgetConfig } from './OverdueReviewsWidget';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: OverdueReviewsWidgetConfig;
  onChange: (config: OverdueReviewsWidgetConfig) => void;
};

export const OverdueReviewsConfigForm = ({ config, onChange }: Props) => {
  const { assessmentTypes } = useWorkspaceContext();

  return (
    <>
      <DialogSection label="Assessment type" required={false}>
        <Select.Root
          value={config.assessmentTypeId ?? ''}
          onChange={value => onChange({ ...config, assessmentTypeId: optionalText(value ?? '') })}
        >
          <Select.Item value="">Any assessment type</Select.Item>
          {assessmentTypes
            .filter(type => type.is_active || type.id === config.assessmentTypeId)
            .map(type => (
              <Select.Item key={type.id} value={type.id}>
                {type.name}
                {!type.is_active ? ' (inactive)' : ''}
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
                placeholder="e.g. Overdue risk and control reviews"
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
