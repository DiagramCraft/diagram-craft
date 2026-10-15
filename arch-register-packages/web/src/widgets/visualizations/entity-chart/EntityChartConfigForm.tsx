import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel } from '../../../components/EntityFilterPanel';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import type { ConfigFormProps } from '../../shared/types';
import type { EntityChartWidgetConfig } from './types';
import styles from './EntityChartConfigForm.module.css';

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
    <DialogSection label="Filters">
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
    </DialogSection>

    <DialogSection label="Chart settings">
      <div className={styles.options}>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Group by</span>
          <div className={styles.optionControl}>
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
          </div>
        </label>
        <label className={styles.optionRow}>
          <span className={styles.optionLabel}>Chart type</span>
          <div className={styles.optionControl}>
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
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);
