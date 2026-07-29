import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider
} from '@tanstack/react-router';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { DashboardGrid } from '../../../../dashboard/DashboardGrid';
import { EntityMetric } from './EntityMetric';
import type { EntityMetricType } from './types';
import { MdxContext } from '../../../MdxContext';
import {
  WorkspaceContext,
  type WorkspaceContextType
} from '../../../../../layouts/WorkspaceContext';
import { entityKeys } from '../../../../../queries/entities';
import { projectKeys } from '../../../../../queries/projects';

const WORKSPACE = 'storybook-workspace';

const schemas = [{ entity_count: 128 } as EntitySchema];

const projects = [{ file_count: 3 }, { file_count: 5 }, { file_count: 2 }];

const workspaceContext = {
  workspace: null,
  workspaceSlug: WORKSPACE,
  schemas,
  enums: [],
  projects: [],
  lifecycleStates: [],
  teams: [],
  projectEntityTypes: [],
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
  defaultSettingsSection: null,
  openAddProjectDialog: () => {},
  openAddEntityDialog: () => {}
} satisfies WorkspaceContextType;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false
    }
  }
});

queryClient.setQueryData(projectKeys.list(WORKSPACE), projects);
queryClient.setQueryData(entityKeys.facets(WORKSPACE), {
  completeness: { below50: 2, below80: 3, above80: 5 }
});

const storyRootRoute = createRootRoute({ component: () => null });
const storyRouter = createRouter({
  routeTree: storyRootRoute,
  history: createMemoryHistory({ initialEntries: ['/'] })
});

type ProvidersProps = {
  children: ReactNode;
};

const StoryProviders = ({ children }: ProvidersProps) => (
  <RouterContextProvider router={storyRouter}>
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={workspaceContext}>
        <MdxContext.Provider value={{ workspaceSlug: WORKSPACE, renderMode: 'wiki' }}>
          {children}
        </MdxContext.Provider>
      </WorkspaceContext.Provider>
    </QueryClientProvider>
  </RouterContextProvider>
);

const dashboardWidget = (
  id: string,
  metricType: EntityMetricType,
  x: number,
  y: number,
  w: number,
  h: number
): DashboardWidget => ({
  id,
  type: 'EntityMetric',
  config: { metricType },
  x,
  y,
  w,
  h
});

const DashboardStory = ({ widgets }: { widgets: DashboardWidget[] }) => (
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

const meta = {
  title: 'MDX Blocks/EntityMetric',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiVariants: Story = {
  render: () => (
    <StoryProviders>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <EntityMetric metricType="entity-count" />
        <EntityMetric metricType="project-count" />
        <EntityMetric metricType="diagram-count" />
        <EntityMetric metricType="completeness-percent" />
      </div>
    </StoryProviders>
  )
};

export const DashboardVariants: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('entity-count', 'entity-count', 0, 0, 3, 2),
          dashboardWidget('project-count', 'project-count', 3, 0, 3, 2),
          dashboardWidget('diagram-count', 'diagram-count', 6, 0, 3, 2),
          dashboardWidget('completeness', 'completeness-percent', 9, 0, 3, 2)
        ]}
      />
    </StoryProviders>
  )
};

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory widgets={[dashboardWidget('default', 'entity-count', 0, 0, 3, 2)]} />
    </StoryProviders>
  )
};

export const DashboardWide: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory widgets={[dashboardWidget('wide', 'entity-count', 0, 0, 6, 4)]} />
    </StoryProviders>
  )
};

export const DashboardLarge: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory widgets={[dashboardWidget('large', 'entity-count', 0, 0, 12, 6)]} />
    </StoryProviders>
  )
};
