import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityFilterPanel, type EntityFilterValue } from '../../components/EntityFilterPanel';
import { EmptyState } from '../../components/EmptyState';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import { useSavedViews } from '../../hooks/useSavedViews';
import type { EntityMetricType } from '../markdown/mdx-components/blocks/entity-metric/types';
import styles from './WidgetConfigDialog.module.css';

const METRIC_TYPE_OPTIONS: { value: EntityMetricType; label: string }[] = [
  { value: 'entity-count', label: 'Entity count' },
  { value: 'project-count', label: 'Project count' },
  { value: 'diagram-count', label: 'Diagram count' },
  { value: 'completeness-percent', label: 'Completeness %' }
];

const LIMIT_OPTIONS = [
  { value: '10', label: '10 rows' },
  { value: '20', label: '20 rows' },
  { value: '50', label: '50 rows' }
];

type Props = {
  widget: DashboardWidget | null;
  open: boolean;
  workspaceSlug: string;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void;
};

const titleForWidget = (widget: DashboardWidget): string => {
  switch (widget.type) {
    case 'stat-metric':
      return 'Stat metric';
    case 'saved-view-embed':
      return 'Saved view';
    case 'entity-table':
      return 'Entity table';
    case 'lifecycle-chart':
      return 'Lifecycle chart';
    case 'activity-trend-chart':
      return 'Activity trend chart';
    case 'stale-entity-report':
      return 'Stale entity report';
    case 'activity-feed':
      return 'Activity feed';
  }
};

export const WidgetConfigDialog = ({ widget, open, workspaceSlug, onClose, onSave }: Props) => {
  if (!widget) return null;

  return (
    <WidgetConfigDialogContent
      key={widget.id}
      widget={widget}
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
}: Props & { widget: DashboardWidget }) => {
  const [filter, setFilter] = useState<EntityFilterValue>({
    schemaId: 'schema' in widget ? (widget.schema ?? '') : '',
    owner: 'owner' in widget ? (widget.owner ?? '') : '',
    lifecycle: 'lifecycle' in widget ? (widget.lifecycle ?? '') : ''
  });
  const [metricType, setMetricType] = useState<EntityMetricType>(
    widget.type === 'stat-metric' ? widget.metricType : 'entity-count'
  );
  const [label, setLabel] = useState(widget.type === 'stat-metric' ? (widget.label ?? '') : '');
  const [limit, setLimit] = useState(
    widget.type === 'entity-table' ? String(widget.limit ?? '10') : '10'
  );
  const [viewId, setViewId] = useState(widget.type === 'saved-view-embed' ? widget.viewId : '');
  const [lookbackDays, setLookbackDays] = useState<number | undefined>(
    widget.type === 'activity-trend-chart' ? widget.lookbackDays : undefined
  );
  const [staleAfterDays, setStaleAfterDays] = useState<number | undefined>(
    widget.type === 'stale-entity-report' ? widget.staleAfterDays : undefined
  );
  const [activityLimit, setActivityLimit] = useState<number | undefined>(
    widget.type === 'activity-feed' ? widget.limit : undefined
  );

  const { data: savedViews = [] } = useSavedViews(workspaceSlug, { includeWorkspace: true });
  const adminViews = savedViews.filter(v => v.isAdminView);

  const canSave = widget.type !== 'saved-view-embed' || !!viewId;

  const handleSave = () => {
    if (!canSave) return;

    switch (widget.type) {
      case 'stat-metric':
        onSave({
          ...widget,
          metricType,
          schema: filter.schemaId || undefined,
          owner: filter.owner || undefined,
          lifecycle: filter.lifecycle || undefined,
          label: label || undefined
        });
        break;
      case 'entity-table':
        onSave({
          ...widget,
          schema: filter.schemaId || undefined,
          owner: filter.owner || undefined,
          lifecycle: filter.lifecycle || undefined,
          limit: Number(limit)
        });
        break;
      case 'saved-view-embed':
        onSave({ ...widget, viewId });
        break;
      case 'activity-trend-chart':
        onSave({ ...widget, lookbackDays });
        break;
      case 'stale-entity-report':
        onSave({ ...widget, staleAfterDays });
        break;
      case 'activity-feed':
        onSave({ ...widget, limit: activityLimit });
        break;
      case 'lifecycle-chart':
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
        {widget.type === 'stat-metric' && (
          <>
            <DialogSection label="Metric">
              <Select.Root value={metricType} onChange={v => setMetricType(v as EntityMetricType)}>
                {METRIC_TYPE_OPTIONS.map(option => (
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

        {widget.type === 'entity-table' && (
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

        {widget.type === 'saved-view-embed' && (
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

        {widget.type === 'activity-trend-chart' && (
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

        {widget.type === 'stale-entity-report' && (
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

        {widget.type === 'lifecycle-chart' && (
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
