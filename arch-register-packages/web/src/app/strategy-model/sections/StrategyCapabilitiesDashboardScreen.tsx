import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { strategyAppDefinition } from '../strategyShell';
import { STRATEGY_CAPABILITIES_ID } from '../strategySections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `strategyShell.tsx`) is the source of truth
 * this screen renders, rather than a literal repeated here.
 */
const sectionDashboardAppKey = (): string => {
  const appKey = strategyAppDefinition.sections.find(
    section => section.id === STRATEGY_CAPABILITIES_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Strategy Capabilities section has no dashboard.appKey');
  return appKey;
};

export const StrategyCapabilitiesDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
