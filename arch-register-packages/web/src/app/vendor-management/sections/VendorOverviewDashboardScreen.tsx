import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { vendorManagementAppDefinition } from '../vendorManagementShell';
import { VENDOR_OVERVIEW_ID } from '../vendorManagementSections';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `vendorManagementShell.tsx`) is the source of
 * truth this screen renders, rather than a literal repeated here (matching
 * `GlossaryDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = vendorManagementAppDefinition.sections.find(
    section => section.id === VENDOR_OVERVIEW_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Vendor Management Overview section has no dashboard.appKey');
  return appKey;
};

export const VendorOverviewDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={configurations.isLoading}
      isEnabled={vendorConfig != null}
      loadingMessage="Loading overview…"
      notEnabledMessage="Vendor Management is not enabled."
    />
  );
};
