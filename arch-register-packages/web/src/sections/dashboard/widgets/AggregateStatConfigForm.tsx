import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { getSchemaFieldDefs, FilterRow } from '../../../components/FilterBuilder';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { AggregateStatWidgetConfig } from './AggregateStatWidget';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: AggregateStatWidgetConfig;
  onChange: (config: AggregateStatWidgetConfig) => void;
};

export const AggregateStatConfigForm = ({ config, onChange }: Props) => {
  const { schemas, enums } = useWorkspaceContext();
  const schema = schemas.find(s => s.id === config.schema);
  const fields = getSchemaFieldDefs(schema, enums);
  const showLink = config.showLink ?? true;

  const filter: EntityFilterValue = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };

  const defaultCondition: FilterCondition = {
    fieldId: fields[0]?.id ?? '',
    op: fields[0]?.type === 'select' ? 'equals' : 'not_empty',
    value: ''
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
              // The numerator condition is scoped to the previously selected schema's fields -
              // reset it when the schema changes so it doesn't reference a stale field id.
              numeratorCondition:
                next.schemaId === config.schema ? config.numeratorCondition : undefined
            });
          }}
        />
      </DialogSection>
      <DialogSection label="Counts as met when">
        {!config.schema ? (
          <div className={`${styles.hint} dim`}>Choose an entity type first.</div>
        ) : (
          <FilterRow
            condition={config.numeratorCondition ?? defaultCondition}
            fields={fields}
            onUpdate={updates =>
              onChange({
                ...config,
                numeratorCondition: {
                  ...(config.numeratorCondition ?? defaultCondition),
                  ...updates
                }
              })
            }
            onRemove={() => onChange({ ...config, numeratorCondition: undefined })}
          />
        )}
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
                placeholder="e.g. Compliance coverage"
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Show link</span>
            <div className={styles.optionControl}>
              <input
                type="checkbox"
                checked={showLink}
                onChange={e => onChange({ ...config, showLink: e.target.checked })}
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
