import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  dashboardWidget,
  frameControls
} from '../../shared/mdx/StorybookHarness';

const meta = {
  title: 'Widgets/Content & layout/Markdown',
  tags: ['dashboard', 'workspace-surface', 'project-surface'],
  ...frameControls,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Workspace and project dashboards only: Free-form Markdown text on a dashboard. Use it for headings, explanations, links to other pages or a short note that gives the surrounding widgets context. It is the simplest way to add static narrative to a dashboard; for content that should be versioned and shared use the Wiki page widget instead.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const markdown = `# Release notes

The **July release** includes:

- A configurable Markdown dashboard widget
- Safe external [documentation links](https://example.com/docs)
- Support for \`inline code\` and checklists

> Keep dashboard notes short and useful.

- [x] Review the release
- [ ] Share it with the team`;

export const Default: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('markdown', 'markdown', { title: 'Release notes', markdown }, 0, 0, 12, 15)
        ]}
      />
    </StoryProviders>
  )
};

export const Empty: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'markdown-empty',
            'markdown',
            { title: 'Notes', markdown: '' },
            0,
            0,
            12,
            10
          )
        ]}
      />
    </StoryProviders>
  )
};

export const WithFrame: Story = {
  ...Default,
  args: { showFrame: true }
};
