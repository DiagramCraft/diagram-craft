import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { getMetricSourceOptions } from '../../../sections/entities/components/mapMetricConfig';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { TopEntitiesWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type TopEntitiesConfigFormProps = {
  config: TopEntitiesWidgetConfig;
  onChange: (config: TopEntitiesWidgetConfig) => void;
};

export const TopEntitiesConfigForm = ({ config, onChange }: TopEntitiesConfigFormProps) => {
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
      <DialogSection label="Sort by number of related records" required={false}>
        <Select.Root
          value={config.relationFieldName ?? ''}
          onChange={value =>
            onChange({
              ...config,
              relationFieldName: optionalText(value ?? '')
            })
          }
        >
          <Select.Item value="">Don't rank by relations</Select.Item>
          {(schema?.fields ?? [])
            .filter(field => field.type === 'typedRelation')
            .map(field => (
              <Select.Item key={field.id} value={field.id}>
                {field.name}
              </Select.Item>
            ))}
        </Select.Root>
      </DialogSection>
      <DialogSection label="Sort by field">
        {fieldOptions.length === 0 ? (
          <div className={`${configFormStyles.hint} dim`}>
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
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Order</span>
            <div className={configFormStyles.optionControl}>
              <Select.Root
                value={config.direction ?? 'desc'}
                onChange={value => onChange({ ...config, direction: value as 'asc' | 'desc' })}
              >
                <Select.Item value="desc">Highest first</Select.Item>
                <Select.Item value="asc">Lowest first</Select.Item>
              </Select.Root>
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Show</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={50}
                className={configFormStyles.labelInput}
                value={config.limit ?? 5}
                onChange={e =>
                  onChange({
                    ...config,
                    limit: Math.max(1, Number(e.target.value) || 5)
                  })
                }
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Catalog link</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="checkbox"
                checked={config.showLink ?? true}
                onChange={e =>
                  onChange({
                    ...config,
                    showLink: e.target.checked ? undefined : false
                  })
                }
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Share bars</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="checkbox"
                checked={config.showShareBar ?? false}
                onChange={e =>
                  onChange({
                    ...config,
                    showShareBar: e.target.checked || undefined
                  })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
