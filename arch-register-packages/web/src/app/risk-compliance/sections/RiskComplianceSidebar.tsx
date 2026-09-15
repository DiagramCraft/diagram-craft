import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';
import {
  RISK_RAIL_PATHS,
  RISK_SECTIONS,
  type RiskComplianceRailItemId
} from '../riskComplianceSections';
import styles from '../../../shell/SidePanel.module.css';

/**
 * Section-dependent primary sidebar for the Risk & Compliance app: navigation between the app's
 * five rail sections, gated on the `risk-compliance` capability configuration — mirrors the plain
 * nav-list branch of `../../vendor-management/sections/VendorManagementSidebar.tsx`. This is a
 * scaffold: no per-section facet content yet, that lands alongside each section's real content in
 * later sub-issues of #3151.
 */
export const RiskComplianceSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: RiskComplianceRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveRiskComplianceConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title="Risk & Compliance" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Risk & Compliance is not enabled.</div>
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {RISK_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`risk-compliance-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: RISK_RAIL_PATHS[section.id],
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
