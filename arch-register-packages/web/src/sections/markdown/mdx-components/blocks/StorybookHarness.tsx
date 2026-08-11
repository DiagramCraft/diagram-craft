import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router';
import { createContext, useContext, type ReactNode } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { DashboardGrid } from '../../../dashboard/DashboardGrid';
import { MdxContext } from '../../MdxContext';
import { WorkspaceContext, type WorkspaceContextType } from '../../../../layouts/WorkspaceContext';
import { entityKeys } from '../../../../queries/entities';
import { projectKeys } from '../../../../queries/projectKeys';

export const WORKSPACE = 'storybook-workspace';

const schemas = [
  { id: 'service', name: 'Service', icon: 'server', entity_count: 128, fields: [] }
] as unknown as EntitySchema[];

const lifecycleStates = [
  { id: 'active', label: 'Active', color: '#22c55e' },
  { id: 'planned', label: 'Planned', color: '#f59e0b' }
] as WorkspaceLifecycleState[];

const workspaceContext = {
  workspace: null,
  workspaceSlug: WORKSPACE,
  schemas,
  relationSchemas: [],
  enums: [],
  projects: [],
  lifecycleStates,
  teams: [],
  projectEntityTypes: [],
  assessmentTypes: [],
  permissions: {
    canManageWorkspaces: false,
    canViewSchemas: true,
    canEditSchemas: false,
    canManageTeams: false,
    canViewAudit: false,
    canCreateProjects: false,
    canCreateEntities: false,
    canManageMembers: false,
    canManageJobs: false,
    canManageViews: false,
    canManageDashboard: false,
    canManageAdminViews: false
  },
  availableSettingsSections: [],
  currencies: { currencies: [], default_currency: 'USD' },
  defaultSettingsSection: null,
  openAddProjectDialog: () => {},
  openAddEntityDialog: () => {}
} satisfies WorkspaceContextType;

export const createStoryQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false
      }
    }
  });

export const queryClient = createStoryQueryClient();

queryClient.setQueryData(projectKeys.list(WORKSPACE), [
  { file_count: 3 },
  { file_count: 5 },
  { file_count: 2 }
]);
queryClient.setQueryData(entityKeys.facets(WORKSPACE), {
  completeness: { below50: 2, below80: 3, above80: 5 }
});

const StoryContentContext = createContext<ReactNode>(null);
const StoryRoot = () => useContext(StoryContentContext);

const storyRootRoute = createRootRoute({ component: StoryRoot });
const storyRouter = createRouter({
  routeTree: storyRootRoute,
  history: createMemoryHistory({ initialEntries: ['/'] })
});

export const StoryProviders = ({
  children,
  client = queryClient,
  permissions,
  projectId
}: {
  children: ReactNode;
  client?: QueryClient;
  permissions?: Partial<WorkspaceContextType['permissions']>;
  projectId?: string;
}) => (
  <QueryClientProvider client={client}>
    <WorkspaceContext.Provider
      value={{
        ...workspaceContext,
        permissions: { ...workspaceContext.permissions, ...permissions }
      }}
    >
      <MdxContext.Provider value={{ workspaceSlug: WORKSPACE, projectId, renderMode: 'wiki' }}>
        <StoryContentContext.Provider value={children}>
          <RouterProvider router={storyRouter} />
        </StoryContentContext.Provider>
      </MdxContext.Provider>
    </WorkspaceContext.Provider>
  </QueryClientProvider>
);

export const dashboardWidget = (
  id: string,
  type: string,
  config: Record<string, unknown>,
  x: number,
  y: number,
  w: number,
  h: number
): DashboardWidget => ({
  id,
  type,
  config,
  x,
  y,
  w,
  h
});

export const DashboardStory = ({ widgets }: { widgets: DashboardWidget[] }) => (
  <DashboardGrid
    widgets={widgets}
    canEdit={false}
    isEditing={false}
    onEditingChange={() => {}}
    onSave={() => {}}
    isLoading={false}
    workspaceSlug={WORKSPACE}
  />
);
