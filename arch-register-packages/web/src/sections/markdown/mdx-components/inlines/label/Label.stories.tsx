import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './Label';
import { StoryProviders } from '../../blocks/StorybookHarness';

const meta = {
  title: 'MDX Inlines/Label',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiStatusLabels: Story = {
  render: () => (
    <StoryProviders>
      <p>
        Service status: <Label text="Production" color="#22c55e" />{' '}
        <Label text="Customer-facing" color="#3b82f6" />{' '}
        <Label text="Needs review" color="#f59e0b" />
      </p>
    </StoryProviders>
  )
};

export const WikiWithoutColor: Story = {
  render: () => (
    <StoryProviders>
      <p>
        A neutral label: <Label text="Internal" color="" />
      </p>
    </StoryProviders>
  )
};

export const WikiEmptyText: Story = {
  render: () => (
    <StoryProviders>
      <p>
        Empty labels render nothing between these markers: <span>[</span>
        <Label text="" color="#ef4444" />
        <span>]</span>
      </p>
    </StoryProviders>
  )
};
