import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel } from '../../../../../components/EntityFilterPanel';
import { DialogSection } from '../../../editor/BlockDialog';
import type { EntityTableFilterState } from './types';
import styles from './EntityTableConfigForm.module.css';

export const LIMIT_OPTIONS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' }
];

type Props = {
  value: EntityTableFilterState;
  onChange: (update: Partial<EntityTableFilterState>) => void;
};

export const EntityTableConfigForm = ({ value, onChange }: Props) => (
  <>
    <DialogSection label="Filters" required={false}>
      <EntityFilterPanel
        value={{ schemaId: value.schemaId, owner: value.owner, lifecycle: value.lifecycle }}
        onChange={onChange}
      />
    </DialogSection>
    <DialogSection label="Options">
      <div className={styles.options}>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Limit</span>
          <div className={styles.optionControl}>
            <Select.Root value={value.limit} onChange={limit => onChange({ limit: limit ?? '10' })}>
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
