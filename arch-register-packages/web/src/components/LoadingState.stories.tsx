import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingState } from './LoadingState';

const meta = {
  title: 'Components/LoadingState',
  parameters: {
    layout: 'centered'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithText: Story = {
  render: () => <LoadingState text="Loading diagram..." />
};

export const NoText: Story = {
  render: () => <LoadingState />
};

export const Small: Story = {
  render: () => <LoadingState text="Loading..." size="sm" />
};
