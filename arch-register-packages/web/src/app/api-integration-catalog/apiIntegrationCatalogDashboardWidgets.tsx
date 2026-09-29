import { useNavigate } from '@tanstack/react-router';
import { TbAffiliate, TbAlertTriangle, TbApi, TbChartBar, TbPlugConnected } from 'react-icons/tb';
import { DialogSection } from '../../sections/markdown/editor/BlockDialog';
import type { DashboardWidgetSpec } from '../../sections/markdown/mdx-components/types';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Banner } from '../../components/Banner';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { useSchemas } from '../../hooks/useSchemas';
import { useLifecycleStates } from '../../hooks/useWorkspaceConfig';
import { useEntity } from '../../hooks/useEntities';
import { useEntityDrawer } from '../../sections/entities/entityDrawer/useEntityDrawer';
import { BlastRadiusPanel } from '../../sections/entities/components/BlastRadiusPanel';
import { IC_APIS_ID, IC_INTEGRATIONS_ID, IC_RAIL_PATHS } from './apiIntegrationCatalogSections';
import { useResolvedApiIntegrationCatalogConfig } from './useResolvedApiIntegrationCatalogConfig';
import { ApiIntegrationCatalogAtRiskPanel } from './sections/ApiIntegrationCatalogAtRiskPanel';
import { ApiIntegrationCatalogMostConsumedPanel } from './sections/ApiIntegrationCatalogMostConsumedPanel';
import { ApiIntegrationCatalogStatTiles } from './sections/ApiIntegrationCatalogStatTiles';
import { ApiIntegrationCatalogSingleStatTile } from './sections/ApiIntegrationCatalogSingleStatTile';
import { useNeedsAttentionQueue } from '../../sections/dashboard/widgets/needsAttentionQueue';
import { NeedsAttentionList } from '../../sections/dashboard/widgets/NeedsAttentionList';
import { IC_QUEUE_CASE_KINDS } from './apiIntegrationCatalogQueue';
import {
  PROVIDERS_FIELD,
  CONSUMERS_FIELD,
  resolveTypedRelationSchemaId
} from './apiEndpointRelations';
import {
  API_BLAST_RADIUS_GROUPS,
  API_BLAST_RADIUS_MAX_DEPTH,
  API_BLAST_RADIUS_NO_PATHS_STATE,
  buildApiBlastRadiusPaths
} from './sections/apiBlastRadiusConfig';
import panelStyles from './sections/ApiIntegrationCatalogPanels.module.css';
import styles from '../../sections/dashboard/WidgetConfigDialog.module.css';

type TitleWidgetConfig = Record<string, unknown> & { label?: string };
type ListWidgetConfig = TitleWidgetConfig & { limit: number };
// `entityId` is meant to be set to a dashboard sidebar variable reference (e.g. `$apiEntityId`),
// resolved by `DashboardWidgetRenderer` before this config reaches the widget — see
// `resolveSidebarVariableReferences.ts` and the Impact dashboard's seed in `appDashboardSeeds.ts`.
type ImpactWidgetConfig = TitleWidgetConfig & { entityId?: string };

type TitleConfigFormProps = {
  config: TitleWidgetConfig;
  onChange: (config: TitleWidgetConfig) => void;
};

type ListConfigFormProps = {
  config: ListWidgetConfig;
  onChange: (config: ListWidgetConfig) => void;
};

const optionalLabel = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const isValidTitleConfig = (config: Record<string, unknown>): config is TitleWidgetConfig =>
  config.label === undefined || typeof config.label === 'string';

const isValidListConfig = (config: Record<string, unknown>): config is ListWidgetConfig =>
  isValidTitleConfig(config) &&
  typeof config.limit === 'number' &&
  Number.isInteger(config.limit) &&
  config.limit >= 1 &&
  config.limit <= 20;

const isValidImpactConfig = (config: Record<string, unknown>): config is ImpactWidgetConfig =>
  isValidTitleConfig(config) &&
  (config.entityId === undefined || typeof config.entityId === 'string');

const titleFor = (config: TitleWidgetConfig, fallback: string): string => {
  const label = config.label?.trim();
  return label === undefined || label.length === 0 ? fallback : label;
};

const TitleConfigForm = ({ config, onChange }: TitleConfigFormProps) => (
  <DialogSection label="Display" required={false}>
    <div className={styles.options}>
      <label className={styles.optionRow}>
        <span className={styles.optionLabel}>Title</span>
        <div className={styles.optionControl}>
          <input
            type="text"
            className={styles.labelInput}
            value={config.label ?? ''}
            placeholder="Use the widget name"
            onChange={event =>
              onChange({ ...config, label: optionalLabel(event.currentTarget.value) })
            }
          />
        </div>
      </label>
    </div>
  </DialogSection>
);

const ListConfigForm = ({ config, onChange }: ListConfigFormProps) => (
  <DialogSection label="Display" required={false}>
    <div className={styles.options}>
      <label className={styles.optionRow}>
        <span className={styles.optionLabel}>Title</span>
        <div className={styles.optionControl}>
          <input
            type="text"
            className={styles.labelInput}
            value={config.label ?? ''}
            placeholder="Use the widget name"
            onChange={event =>
              onChange({ ...config, label: optionalLabel(event.currentTarget.value) })
            }
          />
        </div>
      </label>
      <label className={styles.optionRow}>
        <span className={styles.optionLabel}>Maximum visible items</span>
        <div className={styles.optionControl}>
          <input
            type="number"
            className={styles.labelInput}
            min={1}
            max={20}
            step={1}
            value={config.limit}
            onChange={event => onChange({ ...config, limit: Number(event.currentTarget.value) })}
          />
        </div>
      </label>
    </div>
  </DialogSection>
);

const useApiCatalogNavigation = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();

  const openApi = (publicId: string) =>
    navigate({
      to: IC_RAIL_PATHS[IC_APIS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, drawer: publicId })
    });

  const viewCatalog = () =>
    navigate({
      to: IC_RAIL_PATHS[IC_APIS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  const viewIntegrations = () =>
    navigate({
      to: IC_RAIL_PATHS[IC_INTEGRATIONS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, boundary: '1' as const })
    });

  return { workspaceSlug, openApi, viewCatalog, viewIntegrations };
};

const ApiCatalogStatsWidget = ({ config: _config }: { config: TitleWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogStatTiles workspaceId={workspaceSlug} />;
};

const ApiCatalogNeedsAttentionCountWidget = ({
  config: _config
}: {
  config: TitleWidgetConfig;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogSingleStatTile workspaceId={workspaceSlug} kind="needs-attention" />;
};

const ApiCatalogPairGapsWidget = ({ config: _config }: { config: TitleWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogSingleStatTile workspaceId={workspaceSlug} kind="pair-gaps" />;
};

const ApiCatalogNeedsAttentionWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, openApi } = useApiCatalogNavigation();
  const { apiConfig, isLoading, isError } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  const apiSchemaId = apiConfig?.apiSchemaId ?? null;
  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    { schemaId: apiSchemaId, caseKinds: IC_QUEUE_CASE_KINDS, scope: 'workspace' },
    apiSchemaId != null
  );

  if (isLoading) return <LoadingState text="Loading API catalog…" size="sm" />;
  if (isError) return <Banner variant="error">Could not load API catalog configuration.</Banner>;
  if (!apiConfig) return <EmptyState title="API specification not configured" compact />;

  return (
    <NeedsAttentionList
      items={queue.items}
      isLoading={queue.isLoading}
      isError={queue.isError}
      severity="due-date"
      limit={config.limit}
      onOpenEntity={openApi}
    />
  );
};

const ApiCatalogMostConsumedWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, openApi, viewCatalog } = useApiCatalogNavigation();

  return (
    <ApiIntegrationCatalogMostConsumedPanel
      workspaceId={workspaceSlug}
      apiSchemaId={null}
      onOpenApi={openApi}
      onViewCatalog={viewCatalog}
      limit={config.limit}
      embedded
    />
  );
};

const ApiCatalogImpactWidget = ({ config }: { config: ImpactWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { apiConfig } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const entityId = config.entityId ?? '';
  const { data: entity, isLoading } = useEntity(workspaceSlug, entityId, entityId !== '');

  if (entityId === '') {
    return (
      <EmptyState
        title="Select an API"
        subtitle="Pick an API from the sidebar to see what a change to it would reach."
      />
    );
  }
  if (isLoading || !entity) {
    return isLoading ? (
      <LoadingState text="Loading API…" size="sm" />
    ) : (
      <EmptyState title="API not found" subtitle="The selected API no longer exists." />
    );
  }

  const providersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, PROVIDERS_FIELD);
  const consumersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, CONSUMERS_FIELD);

  return (
    <BlastRadiusPanel
      workspaceId={workspaceSlug}
      subject={{ kind: 'entity', entityId: entity._uid }}
      paths={buildApiBlastRadiusPaths(providersRelationSchemaId, consumersRelationSchemaId)}
      groups={API_BLAST_RADIUS_GROUPS}
      showFilters={false}
      maxDepth={API_BLAST_RADIUS_MAX_DEPTH}
      noPathsState={API_BLAST_RADIUS_NO_PATHS_STATE}
      schemas={schemas.data ?? []}
      lifecycleStates={lifecycleStates}
      embedded
    />
  );
};

const ApiCatalogAtRiskWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, viewIntegrations } = useApiCatalogNavigation();

  return (
    <ApiIntegrationCatalogAtRiskPanel
      workspaceId={workspaceSlug}
      onViewIntegrations={viewIntegrations}
      limit={config.limit}
      embedded
    />
  );
};

const ApiCatalogNeedsAttentionHeaderActions = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const { apiConfig } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  const apiSchemaId = apiConfig?.apiSchemaId ?? null;
  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    { schemaId: apiSchemaId, caseKinds: IC_QUEUE_CASE_KINDS, scope: 'workspace' },
    apiSchemaId != null
  );
  return <span className="dim mono">{queue.items.length}</span>;
};

const ApiCatalogMostConsumedHeaderActions = () => {
  const { viewCatalog } = useApiCatalogNavigation();
  return (
    <button type="button" className={panelStyles.panelLink} onClick={viewCatalog}>
      Catalog
    </button>
  );
};

const ApiCatalogAtRiskHeaderActions = () => {
  const { viewIntegrations } = useApiCatalogNavigation();
  return (
    <button type="button" className={panelStyles.panelLink} onClick={viewIntegrations}>
      All integrations
    </button>
  );
};

const ApiCatalogImpactHeaderActions = ({ config }: { config: ImpactWidgetConfig }) => {
  const { openEntityDrawer } = useEntityDrawer();
  const entityId = config.entityId ?? '';
  if (entityId === '') return null;
  return (
    <button
      type="button"
      className={panelStyles.panelLink}
      onClick={() => openEntityDrawer(entityId)}
    >
      Open specification
    </button>
  );
};

export const apiIntegrationCatalogDashboardWidgetSpecs: Array<{
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
}> = [
  {
    type: 'api-integration-catalog-stats',
    spec: {
      icon: TbChartBar,
      label: 'API catalog stats',
      description: 'Workspace API, governance, and integration health metrics.',
      defaultW: 12,
      defaultH: 5,
      surfaces: ['workspace'],
      component: ApiCatalogStatsWidget,
      frame: { hideOutsideEdit: true, padded: false, showIcon: false },
      isValidConfig: isValidTitleConfig,
      createDefaultConfig: () => ({}),
      getTitle: (config: TitleWidgetConfig) => titleFor(config, 'API catalog stats'),
      configForm: TitleConfigForm
    }
  },
  {
    type: 'api-integration-catalog-needs-attention-count',
    spec: {
      icon: TbAlertTriangle,
      label: 'Needs attention (count)',
      description: 'Number of open API change and deprecation cases.',
      defaultW: 3,
      defaultH: 5,
      surfaces: ['workspace'],
      component: ApiCatalogNeedsAttentionCountWidget,
      frame: { hideOutsideEdit: true, padded: false, showIcon: false },
      isValidConfig: isValidTitleConfig,
      createDefaultConfig: () => ({}),
      getTitle: (config: TitleWidgetConfig) => titleFor(config, 'Needs attention (count)'),
      configForm: TitleConfigForm
    }
  },
  {
    type: 'api-integration-catalog-pair-gaps',
    spec: {
      icon: TbChartBar,
      label: 'Provider/consumer gaps',
      description: 'API provider/consumer pairs without a matching Data Flow.',
      defaultW: 3,
      defaultH: 5,
      surfaces: ['workspace'],
      component: ApiCatalogPairGapsWidget,
      frame: { hideOutsideEdit: true, padded: false, showIcon: false },
      isValidConfig: isValidTitleConfig,
      createDefaultConfig: () => ({}),
      getTitle: (config: TitleWidgetConfig) => titleFor(config, 'Provider/consumer gaps'),
      configForm: TitleConfigForm
    }
  },
  {
    type: 'api-integration-catalog-needs-attention',
    spec: {
      icon: TbAlertTriangle,
      label: 'Needs attention',
      description: 'Open API change and deprecation cases awaiting a decision.',
      defaultW: 6,
      defaultH: 16,
      surfaces: ['workspace'],
      component: ApiCatalogNeedsAttentionWidget,
      headerActionsComponent: ApiCatalogNeedsAttentionHeaderActions,
      frame: { padded: false, showIcon: false },
      isValidConfig: isValidListConfig,
      createDefaultConfig: () => ({ limit: 8 }),
      getTitle: (config: ListWidgetConfig) => titleFor(config, 'Needs attention'),
      configForm: ListConfigForm
    }
  },
  {
    type: 'api-integration-catalog-most-consumed',
    spec: {
      icon: TbApi,
      label: 'Most consumed APIs',
      description: 'APIs with the most registered consumers.',
      defaultW: 6,
      defaultH: 16,
      surfaces: ['workspace'],
      component: ApiCatalogMostConsumedWidget,
      headerActionsComponent: ApiCatalogMostConsumedHeaderActions,
      frame: { padded: false, showIcon: false },
      isValidConfig: isValidListConfig,
      createDefaultConfig: () => ({ limit: 6 }),
      getTitle: (config: ListWidgetConfig) => titleFor(config, 'Most consumed APIs'),
      configForm: ListConfigForm
    }
  },
  {
    type: 'api-integration-catalog-at-risk',
    spec: {
      icon: TbPlugConnected,
      label: 'Integrations needing attention',
      description: 'Data flows that cross a boundary or carry restricted data.',
      defaultW: 6,
      defaultH: 16,
      surfaces: ['workspace'],
      component: ApiCatalogAtRiskWidget,
      headerActionsComponent: ApiCatalogAtRiskHeaderActions,
      frame: { padded: false, showIcon: false },
      isValidConfig: isValidListConfig,
      createDefaultConfig: () => ({ limit: 8 }),
      getTitle: (config: ListWidgetConfig) => titleFor(config, 'Integrations needing attention'),
      configForm: ListConfigForm
    }
  },
  {
    type: 'api-integration-catalog-impact',
    spec: {
      icon: TbAffiliate,
      label: 'API impact',
      description:
        'Blast radius (providers, direct consumers, second order) for the API selected in the dashboard sidebar.',
      defaultW: 12,
      defaultH: 30,
      surfaces: ['workspace'],
      component: ApiCatalogImpactWidget,
      headerActionsComponent: ApiCatalogImpactHeaderActions,
      // BlastRadiusPanel renders its own page-level padding (`.panel` in BlastRadiusPanel.module.css)
      // since it's shared with non-widget contexts (the entity drawer); WidgetFrame's own padding
      // on top of that doubled up the spacing, so it's turned off here.
      frame: { padded: false },
      isValidConfig: isValidImpactConfig,
      createDefaultConfig: () => ({ entityId: '$apiEntityId' }),
      getTitle: (config: ImpactWidgetConfig) => titleFor(config, 'Blast radius')
    }
  }
];
