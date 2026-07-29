import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';

const meta = {
  title: 'Dashboard Widgets/Markdown',
  parameters: {
    layout: 'padded'
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

export const DashboardDefault: Story = {
  render: () => (
    <StoryProviders>
      <DashboardStory
        widgets={[
          dashboardWidget('markdown', 'markdown', { title: 'Release notes', markdown }, 0, 0, 6, 6)
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
            6,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};
