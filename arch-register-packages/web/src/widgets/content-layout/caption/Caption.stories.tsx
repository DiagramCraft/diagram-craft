import type { Meta, StoryObj } from '@storybook/react-vite';
import { Caption } from './Caption';
import { StoryProviders } from '../../shared/mdx/StorybookHarness';

const meta = {
  title: 'Widgets/Content & layout/Caption',
  tags: ['mdx', 'block'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Wraps a block (an image, diagram, table or any other widget) in a figure with a caption underneath. With `numbered` set, the caption is prefixed with an automatic running number (Figure 1, Figure 2, ...) that follows the order in the page. Use it so that figures can be referred to from the text. Available in wiki pages only.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const architectureDiagram = (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12,
      padding: 24,
      border: '1px solid var(--cmp-border)',
      borderRadius: 8,
      background: 'var(--cmp-bg)'
    }}
  >
    <div style={{ padding: 16, border: '1px solid var(--cmp-border-focus)', borderRadius: 6 }}>
      Web
    </div>
    <div style={{ padding: 16, border: '1px solid var(--cmp-border-focus)', borderRadius: 6 }}>
      API
    </div>
    <div style={{ padding: 16, border: '1px solid var(--cmp-border-focus)', borderRadius: 6 }}>
      Database
    </div>
  </div>
);

export const WikiNumbered: Story = {
  render: () => (
    <StoryProviders>
      <Caption caption="Request flow across the platform" numbered="true">
        {architectureDiagram}
      </Caption>
    </StoryProviders>
  )
};

export const WikiWithoutCaption: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Without caption text the figure renders just its content, with no empty caption row.'
      }
    }
  },
  render: () => (
    <StoryProviders>
      <Caption>{architectureDiagram}</Caption>
    </StoryProviders>
  )
};

export const WikiNumberedSequence: Story = {
  render: () => (
    <StoryProviders>
      <div style={{ counterReset: 'figure-counter' }}>
        <Caption caption="Request flow across the platform" numbered="true">
          {architectureDiagram}
        </Caption>
        <Caption caption="Deployment topology" numbered="true">
          {architectureDiagram}
        </Caption>
      </div>
    </StoryProviders>
  )
};
