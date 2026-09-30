import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { glossaryAppDefinition, GLOSSARY_RAIL_ITEM_ID } from '../glossaryShell';
import { glossaryConfigQuery } from '../glossaryQueries';

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

export const GlossaryDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const config = useQuery(glossaryConfigQuery(workspaceSlug));
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={config.isLoading}
      isEnabled={config.data != null}
      loadingMessage="Loading glossary…"
      notEnabledMessage="The business glossary is not enabled."
    />
  );
};
