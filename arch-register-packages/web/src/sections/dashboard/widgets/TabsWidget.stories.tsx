import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';

const meta = {
  title: 'Dashboard Widgets/Tabs',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const note = (id: string, title: string, markdown: string, w = 12, h = 8) => ({
  id,
  type: 'markdown',
  config: { title, markdown },
  x: 0,
  y: 0,
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
                    note('left', 'Left', 'Half-width widget.', 6),
                    note('right', 'Right', 'Half-width widget.', 6),
                    note('wide', 'Full width', 'Wraps to a second row.', 12)
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
