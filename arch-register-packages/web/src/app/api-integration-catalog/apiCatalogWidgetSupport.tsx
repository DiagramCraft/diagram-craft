import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { DialogSection } from '../../sections/markdown/editor/BlockDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useApplicationDashboardTarget } from '../../hooks/useApplications';
import styles from '../../sections/dashboard/WidgetConfigDialog.module.css';
import { withInitial } from '../../widgets/shared/configSchema';

/** Widgets without options of their own still tolerate extra keys such as a custom title. */
export const baseWidgetConfigSchema = z.looseObject({});
export const listWidgetConfigSchema = z.looseObject({
  /** Number of rows shown. */
  limit: withInitial(z.number().int().min(1).max(20), 8)
});
export const impactWidgetConfigSchema = z.looseObject({
  entityId: withInitial(z.string().optional(), '$apiEntityId')
});

export type BaseWidgetConfig = z.infer<typeof baseWidgetConfigSchema>;
export type ListWidgetConfig = z.infer<typeof listWidgetConfigSchema>;
export type ImpactWidgetConfig = z.infer<typeof impactWidgetConfigSchema>;

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
