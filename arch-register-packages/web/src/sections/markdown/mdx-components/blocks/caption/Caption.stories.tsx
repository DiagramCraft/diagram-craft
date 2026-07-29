import type { Meta, StoryObj } from '@storybook/react-vite';
import { Caption } from './Caption';
import { StoryProviders } from '../StorybookHarness';

const meta = {
  title: 'MDX Blocks/Caption',
  parameters: {
    layout: 'padded'
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
      <Caption caption="Request flow across the platform" align="center" numbered="true">
        {architectureDiagram}
      </Caption>
    </StoryProviders>
  )
};

export const WikiLeftAligned: Story = {
  render: () => (
    <StoryProviders>
      <Caption caption="Deployment boundary" align="left">
        {architectureDiagram}
      </Caption>
    </StoryProviders>
  )
};

export const WikiRightAligned: Story = {
  render: () => (
    <StoryProviders>
      <Caption caption="Data ownership" align="right">
        {architectureDiagram}
      </Caption>
    </StoryProviders>
  )
};

export const WikiWithoutCaption: Story = {
  render: () => (
    <StoryProviders>
      <Caption>{architectureDiagram}</Caption>
    </StoryProviders>
  )
};
