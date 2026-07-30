import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel } from '../../../../../components/EntityFilterPanel';
import { DialogSection } from '../../../editor/BlockDialog';
import type { EntityTableWidgetConfig } from './types';
import styles from './EntityTableConfigForm.module.css';

export const LIMIT_OPTIONS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' }
];

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: EntityTableWidgetConfig;
  onChange: (config: EntityTableWidgetConfig) => void;
};

export const EntityTableConfigForm = ({ config, onChange }: Props) => {
  const filter = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };
  const limit = String(config.limit ?? 10);

  return (
    <>
      <DialogSection label="Filters" required={false}>
        <EntityFilterPanel
          value={filter}
          onChange={update => {
            const next = { ...filter, ...update };
            onChange({
              ...config,
              schema: optionalText(next.schemaId),
              owner: optionalText(next.owner),
              lifecycle: optionalText(next.lifecycle)
            });
          }}
        />
      </DialogSection>
      <DialogSection label="Options">
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Limit</span>
            <div className={styles.optionControl}>
              <Select.Root
                value={limit}
                onChange={value => onChange({ ...config, limit: Number(value ?? '10') })}
              >
                {LIMIT_OPTIONS.map(option => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
