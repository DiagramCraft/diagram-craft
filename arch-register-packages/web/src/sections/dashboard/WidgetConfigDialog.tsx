import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityFilterPanel, type EntityFilterValue } from '../../components/EntityFilterPanel';
import { EntityPicker } from '../../components/EntityPicker';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useMdxContext } from '../markdown/MdxContext';
import type { EntityMetricType } from '../markdown/mdx-components/blocks/entity-metric/types';
import { EntityTableConfigForm } from '../markdown/mdx-components/blocks/entity-table/EntityTableConfigForm';
import type { EntityTableFilterState } from '../markdown/mdx-components/blocks/entity-table/types';
import {
  DEFAULT_FIELDS,
  filterSchemaFields
} from '../markdown/mdx-components/blocks/entity-card/EntityCard';
import { EntityCardFieldsPicker } from '../markdown/mdx-components/blocks/entity-card/EntityCardFieldsPicker';
import {
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection,
  type EntityGraphDirection
} from '../markdown/mdx-components/blocks/entity-graph/types';
import changelogStyles from '../markdown/mdx-components/blocks/entity-changelog/EntityChangelogDialog.module.css';
import { DocumentBrowserEmbedConfigForm } from '../markdown/mdx-components/blocks/document-browser-embed/DocumentBrowserEmbedConfigForm';
import { DOCUMENT_BROWSER_BASE_COLUMN_IDS } from '../markdown/mdx-components/blocks/document-browser-embed/types';
import type { DocumentBrowserEmbedConfig } from '../markdown/mdx-components/blocks/document-browser-embed/types';
import { EntityBrowserEmbedConfigForm } from '../markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedConfigForm';
import type { EntityBrowserEmbedConfig } from '../markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedCodec';
import { DiagramPicker } from '../../components/DiagramPicker';
import { useContentTree, type ContentScope } from '../../hooks/useContentScope';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { SavedViewSelectField } from '../markdown/mdx-components/blocks/entity-view-embed/SavedViewSelectField';
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
  const { projectId } = useMdxContext();
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
  const [cardEntityId, setCardEntityId] = useState(
    widget.type === 'EntityCard' ? widget.config.entityId : ''
  );
  const [cardFields, setCardFields] = useState<string[]>(() =>
    widget.type === 'EntityCard' && widget.config.fields
      ? widget.config.fields.split(',').filter(Boolean)
      : DEFAULT_FIELDS
  );
  const [graphEntityId, setGraphEntityId] = useState(
    widget.type === 'EntityGraph' ? widget.config.entityId : ''
  );
  const [graphDepth, setGraphDepth] = useState(
    widget.type === 'EntityGraph' ? normalizeEntityGraphDepth(widget.config.depth) : 1
  );
  const [graphDirection, setGraphDirection] = useState<EntityGraphDirection>(
    widget.type === 'EntityGraph' ? normalizeEntityGraphDirection(widget.config.direction) : 'both'
  );
  const [changelogMode, setChangelogMode] = useState<'single' | 'filtered'>(
    widget.type === 'EntityChangelog' && widget.config.entityId ? 'single' : 'filtered'
  );
  const [changelogEntityId, setChangelogEntityId] = useState(
    widget.type === 'EntityChangelog' ? (widget.config.entityId ?? '') : ''
  );
  const [changelogFilter, setChangelogFilter] = useState<EntityFilterValue>({
    schemaId: widget.type === 'EntityChangelog' ? (widget.config.schema ?? '') : '',
    owner: widget.type === 'EntityChangelog' ? (widget.config.owner ?? '') : '',
    lifecycle: widget.type === 'EntityChangelog' ? (widget.config.lifecycle ?? '') : ''
  });
  const [changelogLimit, setChangelogLimit] = useState(
    widget.type === 'EntityChangelog' ? (widget.config.limit ?? '10') : '10'
  );
  const [changelogSince, setChangelogSince] = useState(
    widget.type === 'EntityChangelog' ? (widget.config.since ?? '30d') : '30d'
  );
  const [documentBrowserConfig, setDocumentBrowserConfig] = useState<DocumentBrowserEmbedConfig>(
    widget.type === 'DocumentBrowserEmbed'
      ? widget.config
      : {
          q: '',
          conditions: [],
          sort: 'updated_at',
          sortDir: 'desc',
          visibleBaseColumnIds: [...DOCUMENT_BROWSER_BASE_COLUMN_IDS],
          visibleFieldIds: []
        }
  );
  const [diagramFileId, setDiagramFileId] = useState(
    widget.type === 'DiagramEmbed' ? widget.config.fileId : ''
  );
  const [diagramCaption, setDiagramCaption] = useState(
    widget.type === 'DiagramEmbed' ? (widget.config.caption ?? '') : ''
  );
  const initialEntityBrowserConfig = widget.type === 'EntityBrowserEmbed' ? widget.config : null;
  const [entityBrowserConfig, setEntityBrowserConfig] = useState<EntityBrowserEmbedConfig>(
    initialEntityBrowserConfig ?? {
      q: '',
      conditions: [],
      sort: 'name',
      view: 'table',
      viewConfigs: {},
      projectScope: projectId ? 'project' : 'all'
    }
  );

  const { schemas } = useWorkspaceContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId,
    includeWorkspace: true
  });
  const adminViews = savedViews.filter(v => v.isAdminView);
  const surface: WidgetSurface = projectId ? 'project' : 'workspace';
  const metricTypeOptions = METRIC_TYPE_OPTIONS.filter(option => option.surfaces.includes(surface));

  const { data: cardEntity } = useEntity(workspaceSlug, cardEntityId);
  const cardSchema = schemas.find(s => s.id === cardEntity?._schema?.id);
  const cardSchemaFields = filterSchemaFields(cardSchema?.fields ?? []);
  const toggleCardField = (fieldId: string) =>
    setCardFields(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    );

  const { data: graphEntity } = useEntity(workspaceSlug, graphEntityId);

  const { data: changelogEntity } = useEntity(workspaceSlug, changelogEntityId);
  const changelogHasSingleEntity = changelogMode === 'single' && !!changelogEntityId;
  const changelogHasFilter =
    changelogMode === 'filtered' &&
    !!(changelogFilter.schemaId || changelogFilter.owner || changelogFilter.lifecycle);

  const diagramContentScope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : { kind: 'workspace', workspaceId: workspaceSlug };
  const { data: diagramFileTree } = useContentTree(diagramContentScope);

  const canSave =
    (widget.type !== 'EntityViewEmbed' || !!viewId) &&
    (widget.type !== 'EntityCard' || !!cardEntityId) &&
    (widget.type !== 'EntityGraph' || !!graphEntityId) &&
    (widget.type !== 'EntityChangelog' || changelogHasSingleEntity || changelogHasFilter) &&
    (widget.type !== 'DiagramEmbed' || !!diagramFileId);

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
      case 'EntityCard':
        onSave({
          ...widget,
          config: { entityId: cardEntityId, fields: cardFields.join(',') }
        });
        break;
      case 'EntityGraph':
        onSave({
          ...widget,
          config: { entityId: graphEntityId, depth: graphDepth, direction: graphDirection }
        });
        break;
      case 'EntityChangelog':
        onSave({
          ...widget,
          config: {
            entityId: changelogHasSingleEntity ? changelogEntityId : undefined,
            schema: changelogHasSingleEntity ? undefined : optionalText(changelogFilter.schemaId),
            owner: changelogHasSingleEntity ? undefined : optionalText(changelogFilter.owner),
            lifecycle: changelogHasSingleEntity
              ? undefined
              : optionalText(changelogFilter.lifecycle),
            limit: changelogLimit,
            since: changelogSince
          }
        });
        break;
      case 'DocumentBrowserEmbed':
        onSave({ ...widget, config: documentBrowserConfig });
        break;
      case 'EntityBrowserEmbed':
        onSave({ ...widget, config: entityBrowserConfig });
        break;
      case 'DiagramEmbed':
        onSave({
          ...widget,
          config: { fileId: diagramFileId, caption: optionalText(diagramCaption) }
        });
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
      width={
        widget.type === 'DocumentBrowserEmbed' || widget.type === 'EntityBrowserEmbed'
          ? 'min(1200px, 92vw)'
          : 460
      }
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
          <EntityTableConfigForm
            value={{ ...filter, limit }}
            onChange={(update: Partial<EntityTableFilterState>) => {
              const { limit: limitUpdate, ...filterUpdate } = update;
              if (Object.keys(filterUpdate).length > 0) {
                setFilter(prev => ({ ...prev, ...filterUpdate }));
              }
              if (limitUpdate !== undefined) setLimit(limitUpdate);
            }}
          />
        )}

        {widget.type === 'EntityViewEmbed' && (
          <DialogSection label="View">
            <SavedViewSelectField adminViews={adminViews} value={viewId} onChange={setViewId} />
          </DialogSection>
        )}

        {widget.type === 'EntityCard' && (
          <>
            <DialogSection label="Entity">
              <EntityPicker
                selectedEntityId={cardEntityId}
                selectedEntity={cardEntity}
                onSelectEntity={entity => setCardEntityId(entity._publicId)}
                onClearEntity={() => setCardEntityId('')}
              />
            </DialogSection>
            {cardEntityId && (
              <DialogSection label="Fields" required={false}>
                <EntityCardFieldsPicker
                  schemaFields={cardSchemaFields}
                  selectedFields={cardFields}
                  onToggleField={toggleCardField}
                />
              </DialogSection>
            )}
          </>
        )}

        {widget.type === 'EntityGraph' && (
          <>
            <DialogSection label="Entity">
              <EntityPicker
                selectedEntityId={graphEntityId}
                selectedEntity={graphEntity}
                onSelectEntity={entity => setGraphEntityId(entity._publicId)}
                onClearEntity={() => setGraphEntityId('')}
              />
            </DialogSection>
            <DialogSection label="Options" required={false}>
              <div className={styles.options}>
                <label className={styles.optionRow}>
                  <span className={styles.optionLabel}>Depth</span>
                  <div className={styles.optionControl}>
                    <NumberInput
                      value={graphDepth}
                      min={1}
                      max={3}
                      step={1}
                      onChange={value => setGraphDepth(normalizeEntityGraphDepth(value))}
                      style={{ width: '64px' }}
                    />
                  </div>
                </label>
                <label className={styles.optionRow}>
                  <span className={styles.optionLabel}>Direction</span>
                  <div className={styles.optionControl}>
                    <Select.Root
                      value={graphDirection}
                      onChange={value => setGraphDirection(normalizeEntityGraphDirection(value))}
                    >
                      <Select.Item value="both">Both directions</Select.Item>
                      <Select.Item value="upstream">Upstream dependencies</Select.Item>
                      <Select.Item value="downstream">Downstream impact</Select.Item>
                    </Select.Root>
                  </div>
                </label>
              </div>
            </DialogSection>
          </>
        )}

        {widget.type === 'EntityChangelog' && (
          <>
            <DialogSection label="Source">
              <div className={changelogStyles.modeTabs}>
                <button
                  type="button"
                  className={`${changelogStyles.modeTab} ${changelogMode === 'single' ? changelogStyles.modeTabActive : ''}`}
                  onClick={() => setChangelogMode('single')}
                >
                  Single entity
                </button>
                <button
                  type="button"
                  className={`${changelogStyles.modeTab} ${changelogMode === 'filtered' ? changelogStyles.modeTabActive : ''}`}
                  onClick={() => setChangelogMode('filtered')}
                >
                  Filtered set
                </button>
              </div>

              {changelogMode === 'single' && (
                <EntityPicker
                  selectedEntityId={changelogEntityId}
                  selectedEntity={changelogEntity}
                  onSelectEntity={entity => setChangelogEntityId(entity._publicId)}
                  onClearEntity={() => setChangelogEntityId('')}
                />
              )}

              {changelogMode === 'filtered' && (
                <EntityFilterPanel
                  value={changelogFilter}
                  onChange={update => setChangelogFilter(prev => ({ ...prev, ...update }))}
                />
              )}
            </DialogSection>

            <DialogSection label="Options" required={false}>
              <div className={changelogStyles.options}>
                <label className={changelogStyles.optionRow}>
                  <span className={changelogStyles.optionLabel}>Limit</span>
                  <select
                    className={changelogStyles.optionSelect}
                    value={changelogLimit}
                    onChange={e => setChangelogLimit(e.target.value)}
                  >
                    <option value="10">10 entries</option>
                    <option value="20">20 entries</option>
                    <option value="50">50 entries</option>
                  </select>
                </label>
                <label className={changelogStyles.optionRow}>
                  <span className={changelogStyles.optionLabel}>Since</span>
                  <select
                    className={changelogStyles.optionSelect}
                    value={changelogSince}
                    onChange={e => setChangelogSince(e.target.value)}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="365d">Last year</option>
                    <option value="">All time</option>
                  </select>
                </label>
              </div>
            </DialogSection>
          </>
        )}

        {widget.type === 'DocumentBrowserEmbed' && (
          <DialogSection label="Filters" required={false}>
            <DocumentBrowserEmbedConfigForm
              value={documentBrowserConfig}
              onChange={setDocumentBrowserConfig}
            />
          </DialogSection>
        )}

        {widget.type === 'EntityBrowserEmbed' && (
          <EntityBrowserEmbedConfigForm
            projectId={projectId}
            initialConfig={initialEntityBrowserConfig}
            onChange={setEntityBrowserConfig}
          />
        )}

        {widget.type === 'DiagramEmbed' && (
          <>
            <DialogSection label="Diagram">
              <DiagramPicker
                fileTree={diagramFileTree}
                selectedId={diagramFileId}
                onSelect={(file: ProjectFile) => setDiagramFileId(file.id)}
              />
            </DialogSection>
            <DialogSection label="Caption" required={false}>
              <input
                type="text"
                className={styles.labelInput}
                value={diagramCaption}
                onChange={e => setDiagramCaption(e.target.value)}
                placeholder="Add a caption…"
              />
            </DialogSection>
          </>
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
