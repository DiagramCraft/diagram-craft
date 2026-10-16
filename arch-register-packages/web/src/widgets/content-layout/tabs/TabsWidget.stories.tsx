import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  dashboardWidget,
  frameControls,
  configDialogStory
} from '../../shared/mdx/StorybookHarness';

const meta = {
  title: 'Widgets/Content & layout/Tabs (Dashboard)',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace and project dashboards only: Groups other dashboard widgets under switchable tabs. Every tab holds its own set of widgets with their own grid layout, which lets one dashboard host several themed views in the same space. Widgets in inactive tabs are not rendered until the tab is opened. Tabs can be edited in the dashboard editor.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const note = (
  id: string,
  title: string,
  markdown: string,
  { x = 0, y = 0, w = 12, h = 8 }: { x?: number; y?: number; w?: number; h?: number } = {}
) => ({
  id,
  type: 'markdown',
  config: { title, markdown },
  x,
  y,
  w,
  h
});

export const RegisterAndMatrix: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'tabs',
            'tabs',
            {
              tabs: [
                {
                  id: 'register',
                  label: 'Register',
                  widgets: [note('register-note', 'Register', 'A **sortable** table goes here.')]
                },
                {
                  id: 'matrix',
                  label: 'Matrix',
                  widgets: [
                    note('matrix-note', 'Matrix', 'A *likelihood × impact* grid goes here.')
                  ]
                }
              ]
            },
            0,
            0,
            12,
            12
          )
        ]}
      />
    </StoryProviders>
  )
};

export const MultipleWidgetsPerTab: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'tabs-multi',
            'tabs',
            {
              tabs: [
                {
                  id: 'overview',
                  label: 'Overview',
                  widgets: [
                    note('left', 'Left', 'Half-width widget.', { w: 6 }),
                    note('right', 'Right', 'Half-width widget.', {
                      x: 6,
                      w: 6
                    }),
                    note('wide', 'Full width', 'Sits on a second row.', {
                      y: 8
                    })
                  ]
                },
                {
                  id: 'details',
                  label: 'Details',
                  widgets: [note('details-note', 'Details', 'Second tab content.')]
                }
              ]
            },
            0,
            0,
            12,
            22
          )
        ]}
      />
    </StoryProviders>
  )
};

export const EmptyTab: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'tabs-empty',
            'tabs',
            { tabs: [{ id: 'empty', label: 'Empty', widgets: [] }] },
            0,
            0,
            12,
            6
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...RegisterAndMatrix,
  args: { showFrame: true }
};

export const ConfigDialog = configDialogStory('tabs');
