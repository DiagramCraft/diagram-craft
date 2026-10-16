import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router';
import { CapabilityEvaluator, PermissionChecker } from '@arch-register/permissions';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Dialog, DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import {
  WorkspaceAuthorizationSourceContext,
  type WorkspaceAuthorizationSource
} from '../../../auth/WorkspaceAuthorizationContext';
import { DashboardGrid } from '../../../sections/dashboard/DashboardGrid';
import { WidgetConfigDialog } from '../../../sections/dashboard/WidgetConfigDialog';
import { DialogContent } from '../../../sections/markdown/editor/BlockDialog';
import { getConfigDialogWidth } from '../configDialog';
import { createDefaultConfig, getWidgetDefinition } from '../widgetRegistry';
import { MdxContext } from '../../../sections/markdown/MdxContext';
import { WorkspaceContext, type WorkspaceContextType } from '../../../layouts/WorkspaceContext';
import { entityKeys } from '../../../queries/entities';
import { projectKeys } from '../../../queries/projectKeys';

export const WORKSPACE = 'storybook-workspace';

const schemas = [
  {
    id: 'service',
    name: 'Service',
    icon: 'server',
    entity_count: 128,
    fields: []
  }
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
  categories: [],
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
        // Stories seed data with setQueryData when their module loads; without an observer that
        // data is garbage collected after the default 5 minutes, leaving the story empty.
        gcTime: Infinity,
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

// No signed-in user: workspace checks fail closed and field group access defaults to editable.
const storyAuthorizationSource: WorkspaceAuthorizationSource = {
  getContext: () => null,
  checker: new PermissionChecker(),
  capabilities: new CapabilityEvaluator()
};

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
  projectId,
  schemas: schemasOverride,
  relationSchemas: relationSchemasOverride
}: {
  children: ReactNode;
  client?: QueryClient;
  permissions?: Partial<WorkspaceContextType['permissions']>;
  projectId?: string;
  schemas?: EntitySchema[];
  relationSchemas?: RelationSchema[];
}) => (
  <QueryClientProvider client={client}>
    <WorkspaceContext.Provider
      value={{
        ...workspaceContext,
        schemas: schemasOverride ?? workspaceContext.schemas,
        relationSchemas: relationSchemasOverride ?? workspaceContext.relationSchemas,
        permissions: { ...workspaceContext.permissions, ...permissions }
      }}
    >
      <WorkspaceAuthorizationSourceContext.Provider value={storyAuthorizationSource}>
        <MdxContext.Provider value={{ workspaceSlug: WORKSPACE, projectId, renderMode: 'wiki' }}>
          <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
            <PortalContextProvider>
              <StoryContentContext.Provider value={children}>
                <RouterProvider router={storyRouter} />
              </StoryContentContext.Provider>
            </PortalContextProvider>
          </DialogContextProvider>
        </MdxContext.Provider>
      </WorkspaceAuthorizationSourceContext.Provider>
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

const WidgetFrameContext = createContext(false);

/**
 * Meta fragment for stories of dashboard widgets: adds a `showFrame` control that shows the
 * dashboard widget frame (border and header) around the widgets of `DashboardStory`. Without it
 * stories render the widget bare, as it appears on a dashboard with the frame hidden.
 */
export const frameControls = {
  args: { showFrame: false },
  argTypes: {
    showFrame: {
      control: 'boolean' as const,
      description: 'Show the dashboard widget frame around the widget'
    }
  },
  decorators: [
    (Story: () => ReactNode, context: { args: { showFrame?: boolean } }) => (
      <WidgetFrameContext.Provider value={!!context.args.showFrame}>
        <Story />
      </WidgetFrameContext.Provider>
    )
  ]
};

export const DashboardStory = ({ widgets }: { widgets: DashboardWidget[] }) => {
  const showFrame = useContext(WidgetFrameContext);
  return (
    <DashboardGrid
      widgets={widgets.map(widget => ({
        ...widget,
        frame: { ...widget.frame, showFrame }
      }))}
      canEdit={false}
      isEditing={false}
      onEditingChange={() => {}}
      onSave={() => {}}
      isLoading={false}
      workspaceSlug={WORKSPACE}
    />
  );
};

type ConfigStoryOptions = {
  /** Config the form starts from; defaults to the widget's default config. */
  config?: Record<string, unknown>;
  client?: QueryClient;
  schemas?: EntitySchema[];
  relationSchemas?: RelationSchema[];
};

const useStoryDefinition = (type: string, config: Record<string, unknown> | undefined) => {
  const definition = getWidgetDefinition(type);
  if (!definition) throw new Error(`No widget "${type}" is registered`);
  const [initial] = useState(
    () => config ?? createDefaultConfig(definition, { workspaceSlug: WORKSPACE })
  );
  return { definition, initial };
};

/** The widget's config dialog, already open. Dashboard widgets get the dashboard dialog. */
const ConfigDialogPreview = ({
  type,
  config
}: {
  type: string;
  config?: Record<string, unknown>;
}) => {
  const { definition, initial } = useStoryDefinition(type, config);
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState(initial);
  const ConfigForm = definition.configForm;

  return (
    <>
      <button type={'button'} onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {definition.dashboard ? (
        <WidgetConfigDialog
          widget={dashboardWidget('config-story', type, initial, 0, 0, 3, 8)}
          open={open}
          onClose={() => setOpen(false)}
          onSave={() => setOpen(false)}
        />
      ) : (
        ConfigForm && (
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={definition.name}
            width={getConfigDialogWidth(definition.configDialog)}
            buttons={[
              {
                label: 'Cancel',
                type: 'cancel',
                onClick: () => setOpen(false)
              },
              { label: 'Save', type: 'default', onClick: () => setOpen(false) }
            ]}
          >
            <DialogContent>
              <ConfigForm
                config={value}
                onChange={setValue}
                context={{ mode: 'mdx', surface: 'workspace' }}
              />
            </DialogContent>
          </Dialog>
        )
      )}
    </>
  );
};

/**
 * `ConfigDialog` story for a widget: the dialog that hosts its config form, already open.
 * Use as `export const ConfigDialog = configDialogStory('Metric');`.
 */
export const configDialogStory = (type: string, options: ConfigStoryOptions = {}) => ({
  name: 'Config dialog',
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
  render: () => (
    <StoryProviders
      client={options.client}
      schemas={options.schemas}
      relationSchemas={options.relationSchemas}
    >
      <ConfigDialogPreview type={type} config={options.config} />
    </StoryProviders>
  )
});
