import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { TbClipboardCheck } from 'react-icons/tb';
import { withWorkspaceShell } from './workspaceShellRoute';
import { GovernanceInboxScreen } from '../../sections/governance/GovernanceInboxScreen';

export const createGovernanceWorkspaceRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const route = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'governance',
      component: GovernanceInboxScreen
    }),
    () => ({
      variant: 'full-bleed' as const,
      activeRailItem: 'governance' as const,
      breadcrumbs: [
        {
          label: 'My work',
          icon: <TbClipboardCheck size={12} />,
          onClick: () => {}
        }
      ]
    })
  );

  return [route] as const;
};
