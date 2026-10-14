import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { formatMeasured, measuredValue, type MeasuredValue } from './fieldAggregation';
import styles from './WidgetRowList.module.css';
import { TbListNumbers } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { Select } from '@diagram-craft/app-components/Select';
import { EntityFilterPanel, type EntityFilterValue } from '../../../components/EntityFilterPanel';
import { getMetricSourceOptions } from '../../entities/components/mapMetricConfig';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

const FETCH_LIMIT = 500;

export type TopEntitiesWidgetConfig = {
  /** Schema id. Either this or `schemaName` identifies the ranked entity type. */
  schema: string;
  /** Schema name, resolved against the live workspace schemas (used by seeded dashboards). */
  schemaName?: string;
  owner?: string;
  lifecycle?: string;
  fieldId: string;
  direction: 'asc' | 'desc';
  limit: number;
  /** Draw each row's share of the listed total as a bar under the name. */
  showShareBar?: boolean;
  /** Show the "View in catalog" footer link. Default true. */
  showLink?: boolean;
};

type Props = {
  config: TopEntitiesWidgetConfig;
};

export const TopEntitiesWidget = ({ config }: Props) => {
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaId =
    config.schema || schemas.find(candidate => candidate.name === config.schemaName)?.id || '';
  const hasConfig = !!schemaId && !!config.fieldId;

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    {
      schemaId,
      owner: config.owner || undefined,
      lifecycle: config.lifecycle || undefined,
      limit: FETCH_LIMIT
    },
    { enabled: !!workspaceSlug && hasConfig }
  );

  const direction = config.direction ?? 'desc';
  const limit = config.limit ?? 5;

  const ranked = useMemo(() => {
    const withValue = entities
      .map(entity => ({ entity, value: measuredValue(entity[config.fieldId]) }))
      .filter(
        (item): item is { entity: (typeof entities)[number]; value: MeasuredValue } =>
          item.value !== undefined
      );
    withValue.sort((a, b) =>
      direction === 'desc' ? b.value.amount - a.value.amount : a.value.amount - b.value.amount
    );
    return withValue.slice(0, limit);
  }, [entities, config.fieldId, direction, limit]);

  const shareTotal = ranked.reduce((sum, item) => sum + Math.max(item.value.amount, 0), 0);

  if (!hasConfig) {
    return <div className={`${styles.emptyInline} dim`}>This widget is not fully configured.</div>;
  }

  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading…</div>;
  }

  if (ranked.length === 0) {
    return <div className={`${styles.emptyInline} dim`}>No entities.</div>;
  }

  const goToCatalog = () =>
    navigate({
      to: '/$workspaceSlug/entities',
      params: { workspaceSlug },
      search: {
        filters: JSON.stringify([{ fieldId: '_schemaId', op: 'equals' as const, value: schemaId }])
      }
    });

  return (
    <div className={styles.list}>
      {ranked.map(({ entity, value }) => (
        <button
          key={entity._uid}
          type="button"
          className={`${styles.row} ${config.showShareBar ? styles.rowShare : ''}`}
          onClick={() => openEntityDrawer(entity._publicId)}
        >
          <span className={styles.rowLabel}>{entity._name}</span>
          {config.showShareBar && (
            <span className={styles.shareTrack} aria-hidden>
              <span
                className={styles.shareFill}
                style={{
                  width: `${shareTotal > 0 ? Math.round((Math.max(value.amount, 0) / shareTotal) * 100) : 0}%`
                }}
              />
            </span>
          )}
          <span className={styles.rowMeta}>{formatMeasured(value.amount, value.currency)}</span>
        </button>
      ))}
      {(config.showLink ?? true) && (
        <button type="button" className={styles.footer} onClick={goToCatalog}>
          View in catalog
        </button>
      )}
    </div>
  );
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type TopEntitiesConfigFormProps = {
  config: TopEntitiesWidgetConfig;
  onChange: (config: TopEntitiesWidgetConfig) => void;
};

export const TopEntitiesConfigForm = ({ config, onChange }: TopEntitiesConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(s => s.id === config.schema);
  const fieldOptions = getMetricSourceOptions(schema).filter(
    option => option.source.kind === 'field'
  );

  const filter: EntityFilterValue = {
    schemaId: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? ''
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
              fieldId: next.schemaId === config.schema ? config.fieldId : ''
            });
          }}
        />
      </DialogSection>
      <DialogSection label="Sort by field">
        {fieldOptions.length === 0 ? (
          <div className={`${configFormStyles.hint} dim`}>
            {config.schema
              ? 'This entity type has no numeric fields.'
              : 'Choose an entity type first.'}
          </div>
        ) : (
          <Select.Root
            value={config.fieldId}
            onChange={value => onChange({ ...config, fieldId: value ?? '' })}
          >
            {fieldOptions.map(option => (
              <Select.Item
                key={option.source.kind === 'field' ? option.source.fieldId : ''}
                value={option.source.kind === 'field' ? option.source.fieldId : ''}
              >
                {option.label}
              </Select.Item>
            ))}
          </Select.Root>
        )}
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Order</span>
            <div className={configFormStyles.optionControl}>
              <Select.Root
                value={config.direction ?? 'desc'}
                onChange={value => onChange({ ...config, direction: value as 'asc' | 'desc' })}
              >
                <Select.Item value="desc">Highest first</Select.Item>
                <Select.Item value="asc">Lowest first</Select.Item>
              </Select.Root>
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Show</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={50}
                className={configFormStyles.labelInput}
                value={config.limit ?? 5}
                onChange={e =>
                  onChange({ ...config, limit: Math.max(1, Number(e.target.value) || 5) })
                }
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Catalog link</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="checkbox"
                checked={config.showLink ?? true}
                onChange={e =>
                  onChange({ ...config, showLink: e.target.checked ? undefined : false })
                }
              />
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Share bars</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="checkbox"
                checked={config.showShareBar ?? false}
                onChange={e => onChange({ ...config, showShareBar: e.target.checked || undefined })}
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};

export const TOP_ENTITIES_TYPE = 'TopEntities' as const;

const isDirection = (value: unknown): value is 'asc' | 'desc' =>
  value === 'asc' || value === 'desc';

/**
 * Dashboard-only widget: a ranked list of entities of a chosen schema, sorted by a chosen numeric
 * (or derived-numeric) field - not tied to any particular schema or field name.
 */
export const topEntitiesSpec = defineComponent({
  type: TOP_ENTITIES_TYPE,
  category: 'data-views',
  name: 'Ranked list',
  description: 'The top entities of a type, ranked by a numeric field.',
  dashboardWidget: {
    icon: TbListNumbers,
    defaultW: 4,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: TopEntitiesWidget,
    isValidConfig: (config): config is TopEntitiesWidgetConfig =>
      ((typeof config.schema === 'string' && config.schema.length > 0) ||
        (typeof config.schemaName === 'string' && config.schemaName.length > 0)) &&
      typeof config.fieldId === 'string' &&
      config.fieldId.length > 0 &&
      isDirection(config.direction) &&
      typeof config.limit === 'number' &&
      config.limit > 0 &&
      (config.owner === undefined || typeof config.owner === 'string') &&
      (config.lifecycle === undefined || typeof config.lifecycle === 'string') &&
      (config.showLink === undefined || typeof config.showLink === 'boolean') &&
      (config.showShareBar === undefined || typeof config.showShareBar === 'boolean'),
    createDefaultConfig: () => ({ schema: '', fieldId: '', direction: 'desc', limit: 5 }),
    configForm: TopEntitiesConfigForm
  }
});
