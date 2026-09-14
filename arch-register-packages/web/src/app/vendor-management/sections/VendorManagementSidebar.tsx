import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import {
  VENDOR_RAIL_PATHS,
  VENDOR_SECTIONS,
  type VendorManagementRailItemId
} from '../vendorManagementSections';
import styles from '../../../shell/SidePanel.module.css';

/**
 * Section-dependent primary sidebar for the Vendor Management app: navigation between the app's
 * five rail sections, gated on the `vendor-management` capability configuration (mirrors
 * `../../strategy-model/sections/StrategySidebar.tsx`'s `!enabled` empty state).
 */
export const VendorManagementSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: VendorManagementRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveVendorManagementConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title="Vendor Management" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Vendor management is not enabled.</div>
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {VENDOR_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`vendor-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: VENDOR_RAIL_PATHS[section.id],
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
