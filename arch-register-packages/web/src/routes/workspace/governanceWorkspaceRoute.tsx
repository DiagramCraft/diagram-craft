import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { TbClipboardCheck } from 'react-icons/tb';
import { withWorkspaceShell } from './workspaceShellRoute';
import { validateGovernanceSearch } from '../searchParams';
import { GovernanceSidebar } from '../../sections/governance/GovernanceSidebar';
import { GovernanceInboxScreen } from '../../sections/governance/GovernanceInboxScreen';

export const createGovernanceWorkspaceRoute = <TParentRoute extends AnyRoute>(
  workspaceRoute: TParentRoute
) => {
  const route = withWorkspaceShell(
    createRoute({
      getParentRoute: () => workspaceRoute,
      path: 'governance',
      validateSearch: validateGovernanceSearch,
      component: GovernanceInboxScreen
    }),
    ctx => ({
      variant: 'full-bleed' as const,
      activeRailItem: 'governance' as const,
      breadcrumbs: [
        {
          label: 'My work',
          icon: <TbClipboardCheck size={12} />,
          onClick: () => {}
        }
      ],
      primarySidebar: <GovernanceSidebar workspaceSlug={ctx.workspaceSlug} />
    })
  );

  return [route] as const;
};
