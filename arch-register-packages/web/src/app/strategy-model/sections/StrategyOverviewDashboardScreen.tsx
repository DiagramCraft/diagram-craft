import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppDashboardSectionScreen } from '../../../sections/dashboard/AppDashboardSectionScreen';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { strategyAppDefinition } from '../strategyShell';
import { STRATEGY_OVERVIEW_ID } from '../strategySections';
import { resolveStrategyModelConfig } from '../strategyQueries';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `strategyShell.tsx`) is the source of truth
 * this screen renders, rather than a literal repeated here.
 */
const sectionDashboardAppKey = (): string => {
  const appKey = strategyAppDefinition.sections.find(section => section.id === STRATEGY_OVERVIEW_ID)
    ?.dashboard?.appKey;
  if (!appKey) throw new Error('Strategy Overview section has no dashboard.appKey');
  return appKey;
};

export const StrategyOverviewDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const isEnabled = resolveStrategyModelConfig(configurations.data) != null;
  return (
    <AppDashboardSectionScreen
      appKey={sectionDashboardAppKey()}
      isLoading={configurations.isLoading}
      isEnabled={isEnabled}
      loadingMessage="Loading strategy model…"
      notEnabledMessage="Strategy model is not enabled. Configure the strategy-model capability in workspace settings."
    />
  );
};
