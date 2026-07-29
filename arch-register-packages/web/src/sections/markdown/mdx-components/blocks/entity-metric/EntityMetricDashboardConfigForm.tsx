import { Select } from '@diagram-craft/app-components/Select';
import {
  EntityFilterPanel,
  type EntityFilterValue
} from '../../../../../components/EntityFilterPanel';
import { DialogSection } from '../../../editor/BlockDialog';
import type { WidgetSurface } from '../../types';
import type { EntityMetricType, StatMetricWidgetConfig } from './types';
import styles from './EntityMetricDialog.module.css';

const METRIC_TYPE_OPTIONS: { value: EntityMetricType; label: string; surfaces: WidgetSurface[] }[] =
  [
    { value: 'entity-count', label: 'Entity count', surfaces: ['workspace', 'project'] },
    { value: 'project-count', label: 'Project count', surfaces: ['workspace'] },
    { value: 'diagram-count', label: 'Diagram count', surfaces: ['workspace', 'project'] },
    { value: 'completeness-percent', label: 'Completeness %', surfaces: ['workspace'] }
  ];

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  config: StatMetricWidgetConfig;
  onChange: (config: StatMetricWidgetConfig) => void;
  context: { projectId?: string };
};

export const EntityMetricDashboardConfigForm = ({ config, onChange, context }: Props) => {
  const metricType = config.metricType ?? 'entity-count';
  const surface: WidgetSurface = context.projectId ? 'project' : 'workspace';
  const metricTypeOptions = METRIC_TYPE_OPTIONS.filter(option => option.surfaces.includes(surface));
  const filter: EntityFilterValue = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
  };

  return (
    <>
      <DialogSection label="Metric">
        <Select.Root
          value={metricType}
          onChange={value => onChange({ ...config, metricType: value as EntityMetricType })}
        >
          {metricTypeOptions.map(option => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </DialogSection>
      {metricType === 'entity-count' && (
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
      )}
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
                placeholder="e.g. Services in production"
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
