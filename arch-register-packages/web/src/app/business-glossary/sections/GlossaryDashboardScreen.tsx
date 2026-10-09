import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { glossaryAppDefinition, GLOSSARY_RAIL_ITEM_ID } from '../glossaryShell';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `glossaryShell.tsx`) is the source of truth
 * this screen renders, rather than a literal repeated here (#3469, matching
 * `ApiIntegrationCatalogDashboardScreens.tsx`'s `sectionDashboardAppKey`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = glossaryAppDefinition.sections.find(
    section => section.id === GLOSSARY_RAIL_ITEM_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Business Glossary section has no dashboard.appKey');
  return appKey;
};

export const GlossaryDashboardScreen = () => (
  <AppDashboardScreen appKey={sectionDashboardAppKey()} />
);
