import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import {
  DS_RAIL_PATHS,
  DS_SECTIONS,
  type DataStewardshipRailItemId
} from '../dataStewardshipSections';
import styles from '../../../shell/SidePanel.module.css';

/**
 * Section-dependent primary sidebar for the Data Stewardship app: navigation between the app's
 * five rail sections, gated on the `data-stewardship` capability configuration — mirrors
 * `../../vendor-management/sections/VendorManagementSidebar.tsx`'s `!enabled` empty state and its
 * fallback "Sections" nav list.
 *
 * This is a placeholder for the scaffold: Stewardship / Classification / Change cases & exceptions
 * each render only this shared nav list for now. Real per-section facet content (coverage by
 * domain, classification/transfer facets, case status facets) lands in later sub-issues of #3152,
 * mirroring how `VendorManagementSidebar` grew its own facet content incrementally after its
 * scaffold.
 */
export const DataStewardshipSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: DataStewardshipRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveDataStewardshipConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title="Data Stewardship" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Data stewardship is not enabled.</div>
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {DS_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`data-stewardship-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: DS_RAIL_PATHS[section.id],
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
