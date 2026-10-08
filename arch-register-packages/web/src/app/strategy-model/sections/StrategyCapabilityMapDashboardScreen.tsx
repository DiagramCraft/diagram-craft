import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { strategyAppDefinition } from '../strategyShell';
import { STRATEGY_CAPABILITY_MAP_ID } from '../strategySections';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `strategyShell.tsx`) is the source of truth
 * this screen renders, rather than a literal repeated here.
 */
const sectionDashboardAppKey = (): string => {
  const appKey = strategyAppDefinition.sections.find(
    section => section.id === STRATEGY_CAPABILITY_MAP_ID
  )?.dashboard?.appKey;
  if (!appKey) throw new Error('Strategy Capability map section has no dashboard.appKey');
  return appKey;
};

export const StrategyCapabilityMapDashboardScreen = () => {
  return <AppDashboardScreen appKey={sectionDashboardAppKey()} />;
};
