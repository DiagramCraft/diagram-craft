import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { vendorManagementAppDefinition } from '../vendorManagementShell';
import { VENDOR_CONTRACTS_ID } from '../vendorManagementSections';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `vendorManagementShell.tsx`) is the source of
 * truth this screen renders, rather than a literal repeated here (matching
 * `GlossaryDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = vendorManagementAppDefinition.sections.find(
    section => section.id === VENDOR_CONTRACTS_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Vendor Management Contracts section has no dashboard.appKey');
  return appKey;
};

export const VendorContractsDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={configurations.isLoading}
      isEnabled={vendorConfig != null}
      loadingMessage="Loading contracts…"
      notEnabledMessage="Vendor Management is not enabled."
    />
  );
};
