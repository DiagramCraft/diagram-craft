import { useEffect, useState } from 'react';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { getSchemaFieldDefs, FilterRow } from '../../../components/FilterBuilder';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { useQueryTextCount } from '../../../hooks/useEntityQueryText';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { AggregateStatWidgetConfig } from './AggregateStatWidget';
import type { AggregateStatDisplay } from './aggregateStatQuery';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: AggregateStatWidgetConfig;
  onChange: (config: AggregateStatWidgetConfig) => void;
};

const useDebounced = (value: string, delayMs = 400): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
};

const QueryField = ({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const debounced = useDebounced(value);
  const result = useQueryTextCount(workspaceSlug, debounced);
  const status =
    debounced.trim() === '' || result.isLoading
      ? undefined
      : result.data?.ok === true
        ? `Matches ${result.data.total} record${result.data.total === 1 ? '' : 's'}`
        : (result.data?.errors[0]?.message ?? 'Invalid query');
  return (
    <label className={styles.optionRow}>
      <span className={styles.optionLabel}>{label}</span>
      <div className={styles.optionControl}>
        <textarea
          className={styles.labelInput}
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
        {status && <div className={`${styles.hint} dim`}>{status}</div>}
      </div>
    </label>
  );
};

const QueryModeForm = ({ config, onChange }: Props) => {
  const display = config.display ?? 'count';
  const showLink = config.showLink ?? true;
  const needsDenominator = display !== 'count';
  const numberOrUndefined = (value: string): number | undefined =>
    value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);
  return (
    <>
      <DialogSection label="Query">
        <div className={styles.options}>
          <QueryField
            label="Count records matching"
            value={config.query ?? ''}
            placeholder='e.g. schema:"Data Flow" AND cross_boundary = cross-boundary'
            onChange={query => onChange({ ...config, query })}
          />
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Show as</span>
            <div className={styles.optionControl}>
              <select
                value={display}
                onChange={e =>
                  onChange({ ...config, display: e.target.value as AggregateStatDisplay })
                }
              >
                <option value="count">Count</option>
                <option value="percent">Percent of total</option>
                <option value="ofTotal">Count, with "of total"</option>
              </select>
            </div>
          </label>
          {needsDenominator && (
            <QueryField
              label="Total records"
              value={config.denominatorQuery ?? ''}
              placeholder='e.g. schema:"Control"'
              onChange={denominatorQuery => onChange({ ...config, denominatorQuery })}
            />
          )}
        </div>
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
                placeholder="e.g. Crossing a boundary"
              />
            </div>
          </label>
          <QueryField
            label="Subtext count"
            value={config.subtextQuery ?? ''}
            placeholder="Optional second query, available as {sub}"
            onChange={subtextQuery =>
              onChange({ ...config, subtextQuery: optionalText(subtextQuery) })
            }
          />
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Measure</span>
            <div className={styles.optionControl}>
              <select
                className={styles.labelInput}
                value={config.measure ?? 'count'}
                onChange={e =>
                  onChange({ ...config, measure: e.target.value === 'sum' ? 'sum' : undefined })
                }
              >
                <option value="count">Count of records</option>
                <option value="sum">Sum of a field</option>
              </select>
            </div>
          </label>
          {(config.measure === 'sum' || config.subtextQuery?.trim()) && (
            <label className={styles.optionRow}>
              <span className={styles.optionLabel}>Field to sum</span>
              <div className={styles.optionControl}>
                <input
                  type="text"
                  className={styles.labelInput}
                  value={config.sumFieldId ?? ''}
                  onChange={e => onChange({ ...config, sumFieldId: optionalText(e.target.value) })}
                  placeholder="Number or currency field id, e.g. annual_cost"
                />
              </div>
            </label>
          )}
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Subtext</span>
            <div className={styles.optionControl}>
              <input
                type="text"
                className={styles.labelInput}
                value={config.subtextTemplate ?? ''}
                onChange={e =>
                  onChange({ ...config, subtextTemplate: optionalText(e.target.value) })
                }
                placeholder="e.g. {sub} highly sensitive ({count}, {total}, {subSum} also available)"
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Warn at</span>
            <div className={styles.optionControl}>
              <input
                type="number"
                className={styles.labelInput}
                value={config.severity?.warnAt ?? ''}
                onChange={e =>
                  onChange({
                    ...config,
                    severity: { ...config.severity, warnAt: numberOrUndefined(e.target.value) }
                  })
                }
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Critical at</span>
            <div className={styles.optionControl}>
              <input
                type="number"
                className={styles.labelInput}
                value={config.severity?.critAt ?? ''}
                onChange={e =>
                  onChange({
                    ...config,
                    severity: { ...config.severity, critAt: numberOrUndefined(e.target.value) }
                  })
                }
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Highlight when</span>
            <div className={styles.optionControl}>
              <select
                value={config.severity?.direction ?? 'above'}
                onChange={e =>
                  onChange({
                    ...config,
                    severity: {
                      ...config.severity,
                      direction: e.target.value === 'below' ? 'below' : 'above'
                    }
                  })
                }
              >
                <option value="above">Value is at or above the threshold</option>
                <option value="below">Value is at or below the threshold</option>
              </select>
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

export const AggregateStatConfigForm = ({ config, onChange }: Props) => {
  if (typeof config.query === 'string')
    return <QueryModeForm config={config} onChange={onChange} />;
  return <LegacyAggregateStatConfigForm config={config} onChange={onChange} />;
};

const LegacyAggregateStatConfigForm = ({ config, onChange }: Props) => {
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
