import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import {
  IC_RAIL_PATHS,
  IC_SECTIONS,
  type ApiIntegrationCatalogRailItemId
} from '../apiIntegrationCatalogSections';
import styles from '../../../shell/SidePanel.module.css';

/**
 * Section-dependent primary sidebar for the API & Integration Catalog app: navigation between the
 * app's rail sections, gated on the `api-specification` capability configuration — mirrors
 * `../../data-stewardship/sections/DataStewardshipSidebar.tsx`'s `!enabled` empty state and its
 * fallback "Sections" nav list.
 *
 * This is a placeholder for the scaffold: APIs / Integrations / Sync / Impact each render only
 * this shared nav list for now. Real per-section facet content lands in later sub-issues of #3150
 * (#3316-#3320).
 */
export const ApiIntegrationCatalogSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: ApiIntegrationCatalogRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveApiIntegrationCatalogConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title="API & Integration Catalog" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>
            API & Integration Catalog is not enabled.
          </div>
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {IC_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`api-integration-catalog-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: IC_RAIL_PATHS[section.id],
                    params: { workspaceSlug }
                  })
                }
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};
