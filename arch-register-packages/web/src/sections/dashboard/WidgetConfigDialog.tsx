import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityFilterPanel, type EntityFilterValue } from '../../components/EntityFilterPanel';
import { EmptyState } from '../../components/EmptyState';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useMdxContext } from '../markdown/MdxContext';
import type { EntityMetricType } from '../markdown/mdx-components/blocks/entity-metric/types';
import type { WidgetSurface } from './dashboardWidgetDefaults';
import { parseKnownDashboardWidget, type KnownDashboardWidget } from './dashboardWidgetConfig';
import { getDashboardWidgetSpec } from '../markdown/mdx-components/mdxRegistry';
import styles from './WidgetConfigDialog.module.css';

const METRIC_TYPE_OPTIONS: { value: EntityMetricType; label: string; surfaces: WidgetSurface[] }[] =
  [
    { value: 'entity-count', label: 'Entity count', surfaces: ['workspace', 'project'] },
    { value: 'project-count', label: 'Project count', surfaces: ['workspace'] },
    { value: 'diagram-count', label: 'Diagram count', surfaces: ['workspace', 'project'] },
    { value: 'completeness-percent', label: 'Completeness %', surfaces: ['workspace'] }
  ];

const LIMIT_OPTIONS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' }
];

const configString = (config: Record<string, unknown>, key: string): string =>
  typeof config[key] === 'string' ? config[key] : '';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type Props = {
  widget: DashboardWidget | null;
  open: boolean;
  workspaceSlug: string;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void;
};

const titleForWidget = (widget: DashboardWidget): string =>
  getDashboardWidgetSpec(widget.type)?.label ?? 'Widget';

export const WidgetConfigDialog = ({ widget, open, workspaceSlug, onClose, onSave }: Props) => {
  if (!widget) return null;
  const knownWidget = parseKnownDashboardWidget(widget);
  if (!knownWidget) return null;

  return (
    <WidgetConfigDialogContent
      key={knownWidget.id}
      widget={knownWidget}
      open={open}
      workspaceSlug={workspaceSlug}
      onClose={onClose}
      onSave={onSave}
    />
  );
};

const WidgetConfigDialogContent = ({
  widget,
  open,
  workspaceSlug,
  onClose,
  onSave
}: Props & { widget: KnownDashboardWidget }) => {
  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: configString(widget.config, 'schema'),
    owner: configString(widget.config, 'owner'),
    lifecycle: configString(widget.config, 'lifecycle')
  });
  const [metricType, setMetricType] = useState<EntityMetricType>(
    widget.type === 'EntityMetric' ? widget.config.metricType : 'entity-count'
  );
  const [label, setLabel] = useState(
    widget.type === 'EntityMetric' ? (widget.config.label ?? '') : ''
  );
  const [limit, setLimit] = useState(
    widget.type === 'EntityTable' ? String(widget.config.limit ?? '10') : '10'
  );
  const [viewId, setViewId] = useState(
    widget.type === 'EntityViewEmbed' ? widget.config.viewId : ''
  );
  const [lookbackDays, setLookbackDays] = useState<number | undefined>(
    widget.type === 'entity-activity-trend-chart' ? widget.config.lookbackDays : undefined
  );
  const [staleAfterDays, setStaleAfterDays] = useState<number | undefined>(
    widget.type === 'entity-stale-report' ? widget.config.staleAfterDays : undefined
  );
  const [activityLimit, setActivityLimit] = useState<number | undefined>(
    widget.type === 'activity-feed' ? widget.config.limit : undefined
  );

  const { projectId } = useMdxContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId,
    includeWorkspace: true
  });
  const adminViews = savedViews.filter(v => v.isAdminView);
  const surface: WidgetSurface = projectId ? 'project' : 'workspace';
  const metricTypeOptions = METRIC_TYPE_OPTIONS.filter(option => option.surfaces.includes(surface));

  const canSave = widget.type !== 'EntityViewEmbed' || !!viewId;

  const handleSave = () => {
    if (!canSave) return;

    switch (widget.type) {
      case 'EntityMetric':
        onSave({
          ...widget,
          config: {
            ...widget.config,
            metricType,
            schema: optionalText(filter.schemaId),
            owner: optionalText(filter.owner),
            lifecycle: optionalText(filter.lifecycle),
            label: optionalText(label)
          }
        });
        break;
      case 'EntityTable':
        onSave({
          ...widget,
          config: {
            ...widget.config,
            schema: optionalText(filter.schemaId),
            owner: optionalText(filter.owner),
            lifecycle: optionalText(filter.lifecycle),
            limit: Number(limit)
          }
        });
        break;
      case 'EntityViewEmbed':
        onSave({ ...widget, config: { ...widget.config, viewId } });
        break;
      case 'entity-activity-trend-chart':
        onSave({ ...widget, config: { ...widget.config, lookbackDays } });
        break;
      case 'entity-stale-report':
        onSave({ ...widget, config: { ...widget.config, staleAfterDays } });
        break;
      case 'activity-feed':
        onSave({ ...widget, config: { ...widget.config, limit: activityLimit } });
        break;
      case 'entity-lifecycle-chart':
      case 'active-assessments':
      case 'upcoming-milestones':
        onSave(widget);
        break;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titleForWidget(widget)}
      width={460}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        { label: 'Save', type: 'default', disabled: !canSave, onClick: handleSave }
      ]}
    >
      <DialogContent>
        {widget.type === 'EntityMetric' && (
          <>
            <DialogSection label="Metric">
              <Select.Root value={metricType} onChange={v => setMetricType(v as EntityMetricType)}>
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
                  onChange={update => setFilter(prev => ({ ...prev, ...update }))}
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
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder="e.g. Services in production"
                    />
                  </div>
                </label>
              </div>
            </DialogSection>
          </>
        )}

        {widget.type === 'EntityTable' && (
          <>
            <DialogSection label="Filters" required={false}>
              <EntityFilterPanel
                value={filter}
                onChange={update => setFilter(prev => ({ ...prev, ...update }))}
              />
            </DialogSection>
            <DialogSection label="Options">
              <div className={styles.options}>
                <label className={styles.optionRow}>
                  <span className={styles.optionLabel}>Limit</span>
                  <div className={styles.optionControl}>
                    <Select.Root value={limit} onChange={value => setLimit(value ?? '10')}>
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
        )}

        {widget.type === 'EntityViewEmbed' && (
          <DialogSection label="View">
            {adminViews.length === 0 ? (
              <EmptyState
                compact
                title="No saved views available. Create an admin view in the entity browser first."
              />
            ) : (
              <Select.Root value={viewId} onChange={value => setViewId(value ?? '')}>
                {adminViews.map(view => (
                  <Select.Item key={view.id} value={view.id}>
                    {view.name}
                  </Select.Item>
                ))}
              </Select.Root>
            )}
          </DialogSection>
        )}

        {widget.type === 'entity-activity-trend-chart' && (
          <DialogSection label="Options" required={false}>
            <div className={styles.options}>
              <label className={styles.optionRow}>
                <span className={styles.optionLabel}>Lookback (days)</span>
                <div className={styles.optionControl}>
                  <NumberInput
                    value={lookbackDays ?? ''}
                    min={1}
                    max={365}
                    step={1}
                    onChange={value => setLookbackDays(value)}
                    style={{ width: '80px' }}
                  />
                </div>
              </label>
            </div>
          </DialogSection>
        )}

        {widget.type === 'entity-stale-report' && (
          <DialogSection label="Options" required={false}>
            <div className={styles.options}>
              <label className={styles.optionRow}>
                <span className={styles.optionLabel}>Stale after (days)</span>
                <div className={styles.optionControl}>
                  <NumberInput
                    value={staleAfterDays ?? ''}
                    min={1}
                    max={365}
                    step={1}
                    onChange={value => setStaleAfterDays(value)}
                    style={{ width: '80px' }}
                  />
                </div>
              </label>
            </div>
          </DialogSection>
        )}

        {widget.type === 'activity-feed' && (
          <DialogSection label="Options" required={false}>
            <div className={styles.options}>
              <label className={styles.optionRow}>
                <span className={styles.optionLabel}>Item limit</span>
                <div className={styles.optionControl}>
                  <NumberInput
                    value={activityLimit ?? ''}
                    min={1}
                    max={50}
                    step={1}
                    onChange={value => setActivityLimit(value)}
                    style={{ width: '80px' }}
                  />
                </div>
              </label>
            </div>
          </DialogSection>
        )}

        {(widget.type === 'entity-lifecycle-chart' ||
          widget.type === 'active-assessments' ||
          widget.type === 'upcoming-milestones') && (
          <DialogSection label="Options" required={false}>
            <div className={`${styles.optionRow}`}>
              <span className={styles.optionLabel}>This widget has no configurable options.</span>
            </div>
          </DialogSection>
        )}
      </DialogContent>
    </Dialog>
  );
};
