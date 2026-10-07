import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { vendorManagementAppDefinition } from '../vendorManagementShell';
import { VENDOR_RISK_ID } from '../vendorManagementSections';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `vendorManagementShell.tsx`) is the source of
 * truth this screen renders, rather than a literal repeated here (matching
 * `GlossaryDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = vendorManagementAppDefinition.sections.find(
    section => section.id === VENDOR_RISK_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Vendor Management Risk section has no dashboard.appKey');
  return appKey;
};

export const VendorRiskDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={configurations.isLoading}
      isEnabled={vendorConfig != null}
      loadingMessage="Loading risk…"
      notEnabledMessage="Vendor Management is not enabled."
    />
  );
};
