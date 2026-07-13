import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './Spinner';

const meta = {
  title: 'Components/Spinner',
  parameters: {
    layout: 'centered'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {
  render: () => <Spinner size="md" />
};

export const Small: Story = {
  render: () => <Spinner size="sm" />
};
