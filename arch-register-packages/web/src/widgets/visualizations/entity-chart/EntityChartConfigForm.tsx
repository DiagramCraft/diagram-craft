import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel } from '../../../components/EntityFilterPanel';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import type { ConfigFormProps } from '../../shared/types';
import type { EntityChartWidgetConfig } from './types';

const GROUP_BY_OPTIONS = [
  { value: 'lifecycle', label: 'Status' },
  { value: 'owner', label: 'Owner' },
  { value: 'schema', label: 'Type' }
] as const;

const CHART_TYPE_OPTIONS = [
  { value: 'donut', label: 'Donut' },
  { value: 'bar', label: 'Bar' }
] as const;

export const EntityChartConfigForm = ({
  config,
  onChange
}: ConfigFormProps<EntityChartWidgetConfig>) => (
  <>
    <FormGroup label="Filters" variant="simple">
      <EntityFilterPanel
        value={{
          schemaId: config.schema ?? '',
          owner: config.owner ?? '',
          lifecycle: config.lifecycle ?? ''
        }}
        onChange={update =>
          onChange({
            ...config,
            ...(update.schemaId !== undefined && { schema: update.schemaId }),
            ...(update.owner !== undefined && { owner: update.owner }),
            ...(update.lifecycle !== undefined && { lifecycle: update.lifecycle })
          })
        }
      />
    </FormGroup>

    <FormGroup label="Chart settings" variant="simple">
      <FormGrid>
        <FormGrid.Row label="Group by">
          <Select.Root
            value={config.groupBy}
            onChange={value =>
              onChange({
                ...config,
                groupBy: (value as EntityChartWidgetConfig['groupBy']) ?? 'lifecycle'
              })
            }
          >
            {GROUP_BY_OPTIONS.map(option => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Root>
        </FormGrid.Row>
        <FormGrid.Row label="Chart type">
          <Select.Root
            value={config.chartType}
            onChange={value =>
              onChange({
                ...config,
                chartType: (value as EntityChartWidgetConfig['chartType']) ?? 'donut'
              })
            }
          >
            {CHART_TYPE_OPTIONS.map(option => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Root>
        </FormGrid.Row>
      </FormGrid>
    </FormGroup>
  </>
);
