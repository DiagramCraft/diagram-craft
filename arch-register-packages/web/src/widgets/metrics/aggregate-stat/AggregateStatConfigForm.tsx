import { type FilterCondition } from '@arch-register/api-types/viewContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEffect, useState } from 'react';
import { getSchemaFieldDefs, FilterRow } from '../../../components/FilterBuilder';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { useQueryTextCount } from '../../../hooks/useEntityQueryText';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { type AggregateStatDisplay } from './aggregateStatQuery';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { AggregateStatWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type AggregateStatConfigFormProps = {
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
    <FormGrid.Row label={label}>
      <TextArea
        rows={2}
        value={value}
        placeholder={placeholder}
        style={{ width: '100%' }}
        onChange={v => onChange(v ?? '')}
      />
      {status && <div className={`${configFormStyles.hint} dim`}>{status}</div>}
    </FormGrid.Row>
  );
};

const QueryModeForm = ({ config, onChange }: AggregateStatConfigFormProps) => {
  const display = config.display ?? 'count';
  const showLink = config.showLink ?? true;
  const needsDenominator = display !== 'count';
  return (
    <>
      <FormGroup label="Query" variant="simple">
        <FormGrid>
          <QueryField
            label="Count records matching"
            value={config.query ?? ''}
            placeholder='e.g. schema:"Data Flow" AND cross_boundary = cross-boundary'
            onChange={query => onChange({ ...config, query })}
          />
          <FormGrid.Row label="Show as">
            <Select.Root
              value={display}
              onChange={value =>
                onChange({ ...config, display: (value ?? 'count') as AggregateStatDisplay })
              }
              style={{ width: '100%' }}
            >
              <Select.Item value="count">Count</Select.Item>
              <Select.Item value="percent">Percent of total</Select.Item>
              <Select.Item value="ofTotal">Count, with "of total"</Select.Item>
            </Select.Root>
          </FormGrid.Row>
          {needsDenominator && (
            <QueryField
              label="Total records"
              value={config.denominatorQuery ?? ''}
              placeholder='e.g. schema:"Control"'
              onChange={denominatorQuery => onChange({ ...config, denominatorQuery })}
            />
          )}
        </FormGrid>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <QueryField
            label="Subtext count"
            value={config.subtextQuery ?? ''}
            placeholder="Optional second query, available as {sub}"
            onChange={subtextQuery =>
              onChange({ ...config, subtextQuery: optionalText(subtextQuery) })
            }
          />
          <FormGrid.Row label="Measure">
            <Select.Root
              value={config.measure ?? 'count'}
              onChange={value =>
                onChange({
                  ...config,
                  measure: value === 'sum' || value === 'countDistinct' ? value : undefined
                })
              }
              style={{ width: '100%' }}
            >
              <Select.Item value="count">Count of records</Select.Item>
              <Select.Item value="sum">Sum of a field</Select.Item>
              <Select.Item value="countDistinct">Count of distinct values</Select.Item>
            </Select.Root>
          </FormGrid.Row>
          {config.measure === 'countDistinct' && (
            <FormGrid.Row label="Field to count">
              <TextInput
                value={config.distinctFieldId ?? ''}
                onChange={value => onChange({ ...config, distinctFieldId: optionalText(value ?? '') })}
                placeholder="Field id, e.g. cost_centre"
                style={{ width: '100%' }}
              />
            </FormGrid.Row>
          )}
          {(config.measure === 'sum' || config.subtextQuery?.trim()) && (
            <FormGrid.Row label="Field to sum">
              <TextInput
                value={config.sumFieldId ?? ''}
                onChange={value => onChange({ ...config, sumFieldId: optionalText(value ?? '') })}
                placeholder="Number or currency field id, e.g. annual_cost"
                style={{ width: '100%' }}
              />
            </FormGrid.Row>
          )}
          <FormGrid.Row label="Subtext">
            <TextInput
              value={config.subtextTemplate ?? ''}
              onChange={value =>
                onChange({ ...config, subtextTemplate: optionalText(value ?? '') })
              }
              placeholder="e.g. {sub} highly sensitive ({count}, {total}, {subSum} also available)"
              style={{ width: '100%' }}
            />
          </FormGrid.Row>
          <FormGrid.Row label="Warn at">
            <NumberInput
              value={config.severity?.warnAt ?? ''}
              onChange={value =>
                onChange({ ...config, severity: { ...config.severity, warnAt: value } })
              }
              style={{ width: '80px' }}
            />
          </FormGrid.Row>
          <FormGrid.Row label="Critical at">
            <NumberInput
              value={config.severity?.critAt ?? ''}
              onChange={value =>
                onChange({ ...config, severity: { ...config.severity, critAt: value } })
              }
              style={{ width: '80px' }}
            />
          </FormGrid.Row>
          <FormGrid.Row label="Highlight when">
            <Select.Root
              value={config.severity?.direction ?? 'above'}
              onChange={value =>
                onChange({
                  ...config,
                  severity: {
                    ...config.severity,
                    direction: value === 'below' ? 'below' : 'above'
                  }
                })
              }
              style={{ width: '100%' }}
            >
              <Select.Item value="above">Value is at or above the threshold</Select.Item>
              <Select.Item value="below">Value is at or below the threshold</Select.Item>
            </Select.Root>
          </FormGrid.Row>
        </FormGrid>
        <FormCheckboxList>
          <FormCheckboxList.Row label="Show link">
            <input
              type="checkbox"
              checked={showLink}
              onChange={e => onChange({ ...config, showLink: e.target.checked })}
            />
          </FormCheckboxList.Row>
        </FormCheckboxList>
      </FormGroup>
    </>
  );
};

export const AggregateStatConfigForm = ({ config, onChange }: AggregateStatConfigFormProps) => {
  if (typeof config.query === 'string')
    return <QueryModeForm config={config} onChange={onChange} />;
  return <LegacyAggregateStatConfigForm config={config} onChange={onChange} />;
};

const LegacyAggregateStatConfigForm = ({ config, onChange }: AggregateStatConfigFormProps) => {
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
      <FormGroup label="Entity type" variant="simple">
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
      </FormGroup>
      <FormGroup label="Counts as met when" variant="simple">
        {!config.schema ? (
          <div className={`${configFormStyles.hint} dim`}>Choose an entity type first.</div>
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
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormCheckboxList>
          <FormCheckboxList.Row label="Show link">
            <input
              type="checkbox"
              checked={showLink}
              onChange={e => onChange({ ...config, showLink: e.target.checked })}
            />
          </FormCheckboxList.Row>
        </FormCheckboxList>
      </FormGroup>
    </>
  );
};
