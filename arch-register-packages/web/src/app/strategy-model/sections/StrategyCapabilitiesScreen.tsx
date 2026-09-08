import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { StrategyPlaceholderScreen } from './StrategyPlaceholderScreen';
import { CapabilityDrawer } from './CapabilityDrawer';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import { STRATEGY_CAPABILITIES_ID, STRATEGY_RAIL_PATHS } from '../strategySections';

export const StrategyCapabilitiesScreen = () => {
  const { workspaceSlug, capabilityId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    capabilityId?: string;
  };
  const navigate = useNavigate();
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations.data);

  const openCapability = (id: string) =>
    navigate({
      to: `${STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID]}/$capabilityId`,
      params: { workspaceSlug, capabilityId: id }
    });
  const closeCapability = () =>
    navigate({ to: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID], params: { workspaceSlug } });

  return (
    <>
      <StrategyPlaceholderScreen title="Capabilities" />
      {capabilityId && strategyConfig && (
        <CapabilityDrawer
          workspaceSlug={workspaceSlug}
          capabilityId={capabilityId}
          strategyConfig={strategyConfig}
          onClose={closeCapability}
          onOpenCapability={openCapability}
        />
      )}
    </>
  );
};
