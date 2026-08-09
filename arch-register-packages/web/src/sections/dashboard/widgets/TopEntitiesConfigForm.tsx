import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { getMetricSourceOptions } from '../../entities/components/mapMetricConfig';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { TopEntitiesWidgetConfig } from './TopEntitiesWidget';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: TopEntitiesWidgetConfig;
  onChange: (config: TopEntitiesWidgetConfig) => void;
};

export const TopEntitiesConfigForm = ({ config, onChange }: Props) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(s => s.id === config.schema);
  const fieldOptions = getMetricSourceOptions(schema).filter(
    option => option.source.kind === 'field'
  );

  const filter: EntityFilterValue = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };

  return (
    <>
      <DialogSection label="Entity type">
        <EntityFilterPanel
          value={filter}
          onChange={update => {
            const next = { ...filter, ...update };
            onChange({
              ...config,
              schema: next.schemaId,
              owner: optionalText(next.owner),
              lifecycle: optionalText(next.lifecycle),
              fieldId: next.schemaId === config.schema ? config.fieldId : ''
            });
          }}
        />
      </DialogSection>
      <DialogSection label="Sort by field">
        {fieldOptions.length === 0 ? (
          <div className={`${styles.hint} dim`}>
            {config.schema
              ? 'This entity type has no numeric fields.'
              : 'Choose an entity type first.'}
          </div>
        ) : (
          <Select.Root
            value={config.fieldId}
            onChange={value => onChange({ ...config, fieldId: value ?? '' })}
          >
            {fieldOptions.map(option => (
              <Select.Item
                key={option.source.kind === 'field' ? option.source.fieldId : ''}
                value={option.source.kind === 'field' ? option.source.fieldId : ''}
              >
                {option.label}
              </Select.Item>
            ))}
          </Select.Root>
        )}
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Order</span>
            <div className={styles.optionControl}>
              <Select.Root
                value={config.direction ?? 'desc'}
                onChange={value => onChange({ ...config, direction: value as 'asc' | 'desc' })}
              >
                <Select.Item value="desc">Highest first</Select.Item>
                <Select.Item value="asc">Lowest first</Select.Item>
              </Select.Root>
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Show</span>
            <div className={styles.optionControl}>
              <input
                type="number"
                min={1}
                max={50}
                className={styles.labelInput}
                value={config.limit ?? 5}
                onChange={e =>
                  onChange({ ...config, limit: Math.max(1, Number(e.target.value) || 5) })
                }
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
                onChange={e => onChange({ ...config, label: optionalText(e.target.value) })}
                placeholder="e.g. Top risks by score"
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
