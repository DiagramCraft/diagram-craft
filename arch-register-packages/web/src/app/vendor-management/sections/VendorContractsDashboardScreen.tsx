import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { vendorManagementAppDefinition } from '../vendorManagementShell';
import { VENDOR_CONTRACTS_ID } from '../vendorManagementSections';

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
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
