import { Select } from '@diagram-craft/app-components/Select';
import type { ConfigFormProps } from '../../shared/types';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import type { WidgetSurface } from '../../shared/types';
import type { MetricType, StatMetricWidgetConfig } from './types';

const METRIC_TYPE_OPTIONS: { value: MetricType; label: string; surfaces: WidgetSurface[] }[] = [
  { value: 'entity-count', label: 'Entity count', surfaces: ['workspace', 'project'] },
  { value: 'project-count', label: 'Project count', surfaces: ['workspace'] },
  { value: 'diagram-count', label: 'Diagram count', surfaces: ['workspace', 'project'] },
  { value: 'completeness-percent', label: 'Completeness %', surfaces: ['workspace'] }
];

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = ConfigFormProps<StatMetricWidgetConfig>;

export const MetricConfigForm = ({ config, onChange, context }: Props) => {
  const metricType = config.metricType ?? 'entity-count';
  const metricTypeOptions = METRIC_TYPE_OPTIONS.filter(option =>
    option.surfaces.includes(context.surface)
  );
  const filter: EntityFilterValue = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };
  const showLink = config.showLink ?? true;

  return (
    <>
      <FormGroup label="Metric" variant="simple">
        <Select.Root
          value={metricType}
          onChange={value => onChange({ ...config, metricType: value as MetricType })}
        >
          {metricTypeOptions.map(option => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      {metricType === 'entity-count' && (
        <FormGroup label="Filters" supplementaryLabel="(optional)" variant="simple">
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
        </FormGroup>
      )}
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        {/* On a dashboard the label is the widget title, set under Appearance. */}
        {context.mode !== 'dashboard' && (
          <FormGrid>
            <FormGrid.Row label="Label">
              <TextInput
                value={config.label ?? ''}
                onChange={value => onChange({ ...config, label: optionalText(value ?? '') })}
                placeholder="e.g. Services in production"
                style={{ width: '100%' }}
              />
            </FormGrid.Row>
          </FormGrid>
        )}
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
