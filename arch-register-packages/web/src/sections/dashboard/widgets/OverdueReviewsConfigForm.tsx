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
  const { schemas } = useWorkspaceContext();

  return (
    <>
      <DialogSection label="Entity type" required={false}>
        <Select.Root
          value={config.schema ?? ''}
          onChange={value => onChange({ ...config, schema: optionalText(value ?? '') })}
        >
          <Select.Item value="">Any type</Select.Item>
          {schemas.map(schema => (
            <Select.Item key={schema.id} value={schema.id}>
              {schema.name}
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
