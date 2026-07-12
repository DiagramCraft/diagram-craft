import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './Banner';
import { TbAlertTriangle, TbInfoCircle, TbX } from 'react-icons/tb';

const meta = {
  title: 'Components/Banner',
  component: Banner,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['error', 'warning', 'info']
    }
  }
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  args: {
    variant: 'error',
    children: 'Failed to load workspace members.'
  }
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'This workspace is approaching its member limit.'
  }
};

export const Info: Story = {
  args: {
    variant: 'info',
    children: 'Changes are saved automatically.'
  }
};

export const WithIcon: Story = {
  args: {
    variant: 'error',
    icon: <TbX size={14} />,
    children: 'Something went wrong while saving.'
  }
};

export const WithAction: Story = {
  args: {
    variant: 'warning',
    icon: <TbAlertTriangle size={14} />,
    children: 'Your session will expire soon.',
    action: <button type="button">Extend session</button>
  }
};

export const AllVariants = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <Banner variant="error" icon={<TbX size={14} />}>
        Failed to load workspace members.
      </Banner>
      <Banner variant="warning" icon={<TbAlertTriangle size={14} />}>
        This workspace is approaching its member limit.
      </Banner>
      <Banner variant="info" icon={<TbInfoCircle size={14} />}>
        Changes are saved automatically.
      </Banner>
    </div>
  )
};
