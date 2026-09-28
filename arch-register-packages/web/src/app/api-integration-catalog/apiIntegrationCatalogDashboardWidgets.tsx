import { useNavigate } from '@tanstack/react-router';
import { TbAlertTriangle, TbApi, TbChartBar, TbPlugConnected } from 'react-icons/tb';
import { DialogSection } from '../../sections/markdown/editor/BlockDialog';
import type { DashboardWidgetSpec } from '../../sections/markdown/mdx-components/types';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Banner } from '../../components/Banner';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { IC_APIS_ID, IC_INTEGRATIONS_ID, IC_RAIL_PATHS } from './apiIntegrationCatalogSections';
import { useResolvedApiIntegrationCatalogConfig } from './useResolvedApiIntegrationCatalogConfig';
import { ApiIntegrationCatalogAtRiskPanel } from './sections/ApiIntegrationCatalogAtRiskPanel';
import { ApiIntegrationCatalogMostConsumedPanel } from './sections/ApiIntegrationCatalogMostConsumedPanel';
import { ApiIntegrationCatalogNeedsAttentionPanel } from './sections/ApiIntegrationCatalogNeedsAttentionPanel';
import { ApiIntegrationCatalogStatTiles } from './sections/ApiIntegrationCatalogStatTiles';
import styles from '../../sections/dashboard/WidgetConfigDialog.module.css';

type TitleWidgetConfig = Record<string, unknown> & { label?: string };
type ListWidgetConfig = TitleWidgetConfig & { limit: number };

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

const ApiCatalogNeedsAttentionWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, openApi } = useApiCatalogNavigation();
  const { apiConfig, isLoading, isError } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);

  if (isLoading) return <LoadingState text="Loading API catalog…" size="sm" />;
  if (isError) return <Banner variant="error">Could not load API catalog configuration.</Banner>;
  if (!apiConfig) return <EmptyState title="API specification not configured" compact />;

  return (
    <ApiIntegrationCatalogNeedsAttentionPanel
      workspaceId={workspaceSlug}
      apiSchemaId={apiConfig.apiSchemaId}
      onOpenApi={openApi}
      limit={config.limit}
      embedded
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
      defaultH: 2,
      surfaces: ['workspace'],
      component: ApiCatalogStatsWidget,
      isValidConfig: isValidTitleConfig,
      createDefaultConfig: () => ({}),
      getTitle: (config: TitleWidgetConfig) => titleFor(config, 'API catalog stats'),
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
      defaultH: 4,
      surfaces: ['workspace'],
      component: ApiCatalogNeedsAttentionWidget,
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
      defaultH: 4,
      surfaces: ['workspace'],
      component: ApiCatalogMostConsumedWidget,
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
      defaultH: 4,
      surfaces: ['workspace'],
      component: ApiCatalogAtRiskWidget,
      isValidConfig: isValidListConfig,
      createDefaultConfig: () => ({ limit: 8 }),
      getTitle: (config: ListWidgetConfig) => titleFor(config, 'Integrations needing attention'),
      configForm: ListConfigForm
    }
  }
];
