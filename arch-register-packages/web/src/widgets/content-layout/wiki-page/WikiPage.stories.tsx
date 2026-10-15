import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../shared/mdx/StorybookHarness';
import { projectFileKeys } from '../../../queries/content';
import { markdownContentKeys } from '../../../queries/markdownContent';

const NODE_ID = 'wiki-page-1';

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(projectFileKeys.detail(WORKSPACE, NODE_ID), {
  id: NODE_ID,
  type: 'markdown',
  name: 'Architecture principles',
  project_id: null
});
storyQueryClient.setQueryData(markdownContentKeys.detail(WORKSPACE, NODE_ID), {
  body: '## Architecture principles\n\n- Prefer managed services\n- Own your data\n- Design for failure\n'
});

const meta = {
  title: 'Widgets/Content & layout/Wiki page',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Shows the content of a selected wiki page directly on a dashboard, including any widgets embedded in the page. The title defaults to the page name. Use it to keep long-form guidance next to the live data it describes; the page itself is edited in the wiki. A workspace dashboard can show workspace pages and a project dashboard can show that project's pages."
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[dashboardWidget('wiki-page', 'WikiPage', { nodeId: NODE_ID }, 0, 0, 6, 10)]}
      />
    </StoryProviders>
  )
};

export const UnavailablePage: Story = {
  render: () => (
    <StoryProviders client={createStoryQueryClient()}>
      <DashboardStory
        widgets={[dashboardWidget('wiki-page', 'WikiPage', { nodeId: 'missing' }, 0, 0, 6, 6)]}
      />
    </StoryProviders>
  )
};
