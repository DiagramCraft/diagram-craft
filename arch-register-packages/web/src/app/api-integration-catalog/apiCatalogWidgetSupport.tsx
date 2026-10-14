import { useNavigate } from '@tanstack/react-router';
import { DialogSection } from '../../sections/markdown/editor/BlockDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useApplicationDashboardTarget } from '../../hooks/useApplications';
import styles from '../../sections/dashboard/WidgetConfigDialog.module.css';

export type BaseWidgetConfig = Record<string, unknown>;
export type ListWidgetConfig = BaseWidgetConfig & { limit: number };
export type ImpactWidgetConfig = BaseWidgetConfig & { entityId?: string };

export const isValidBaseConfig = (config: Record<string, unknown>): config is BaseWidgetConfig =>
  config !== null;

export const isValidListConfig = (config: Record<string, unknown>): config is ListWidgetConfig =>
  isValidBaseConfig(config) &&
  typeof config.limit === 'number' &&
  Number.isInteger(config.limit) &&
  config.limit >= 1 &&
  config.limit <= 20;

export const isValidImpactConfig = (
  config: Record<string, unknown>
): config is ImpactWidgetConfig =>
  isValidBaseConfig(config) &&
  (config.entityId === undefined || typeof config.entityId === 'string');

export const ListConfigForm = ({
  config,
  onChange
}: {
  config: ListWidgetConfig;
  onChange: (config: ListWidgetConfig) => void;
}) => (
  <DialogSection label="Display" required={false}>
    <div className={styles.options}>
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

const API_INTEGRATION_CATALOG_KEY = 'api-integration-catalog';

export const useApiCatalogNavigation = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();
  const apisTarget = useApplicationDashboardTarget(
    workspaceSlug,
    API_INTEGRATION_CATALOG_KEY,
    'APIs'
  );
  const integrationsTarget = useApplicationDashboardTarget(
    workspaceSlug,
    API_INTEGRATION_CATALOG_KEY,
    'Integrations'
  );

  const openApi = (publicId: string) => {
    if (!apisTarget) return;
    void navigate({
      ...apisTarget,
      search: ((previous: Record<string, unknown>) => ({ ...previous, drawer: publicId })) as never
    });
  };

  const viewCatalog = () => {
    if (!apisTarget) return;
    void navigate({
      ...apisTarget,
      search: ((previous: Record<string, unknown>) => previous) as never
    });
  };

  const viewIntegrations = () => {
    if (!integrationsTarget) return;
    void navigate({
      ...integrationsTarget,
      // `boundaries` is the Integrations dashboard's "Cross-Boundary Transfer" facet variable.
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        boundaries: 'cross-boundary'
      })) as never
    });
  };

  return { workspaceSlug, openApi, viewCatalog, viewIntegrations };
};
